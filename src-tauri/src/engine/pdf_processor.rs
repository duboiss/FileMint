use anyhow::{anyhow, Result};
use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use lopdf::{Document, Object};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeSet, HashMap, HashSet};
use std::io::Cursor;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PdfCompressionProfile {
    Readable, // Office docs (~200-250 DPI)
    Balanced, // Recommended balance (~150 DPI)
    Compact,  // Aggressive scan compression (~96-120 DPI)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PdfCompressionOptions {
    pub profile: PdfCompressionProfile,
    pub optimize_structure: bool,
    pub recompress_images: bool,
    #[serde(default)]
    pub target_size_kb: Option<u32>,
}

impl Default for PdfCompressionOptions {
    fn default() -> Self {
        Self {
            profile: PdfCompressionProfile::Balanced,
            optimize_structure: true,
            recompress_images: true,
            target_size_kb: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PdfResultInfo {
    pub original_bytes: u64,
    pub compressed_bytes: u64,
    pub saved_percentage: f32,
    pub pages_count: u32,
    pub image_count_optimized: u32,
}

fn compress_doc_internal(
    mut doc: Document,
    target_jpeg_quality: u8,
    target_max_dim: u32,
    recompress_images: bool,
    optimize_structure: bool,
) -> Result<(Vec<u8>, u32)> {
    let mut image_count_optimized = 0;

    if recompress_images {
        let object_ids: Vec<_> = doc.objects.keys().cloned().collect();
        for id in object_ids {
            if let Some(Object::Stream(ref mut stream)) = doc.objects.get_mut(&id) {
                let is_image = stream
                    .dict
                    .get(b"Subtype")
                    .is_ok_and(|val| val.as_name().is_ok_and(|name| name == b"Image"));

                if is_image {
                    if let Ok(decompressed_data) = stream.decompressed_content() {
                        let width = stream
                            .dict
                            .get(b"Width")
                            .and_then(|w| w.as_i64())
                            .unwrap_or(0) as u32;
                        let height = stream
                            .dict
                            .get(b"Height")
                            .and_then(|h| h.as_i64())
                            .unwrap_or(0) as u32;

                        if width > 0 && height > 0 {
                            if let Ok(dynamic_img) = image::load_from_memory(&decompressed_data) {
                                let (orig_w, orig_h) = (dynamic_img.width(), dynamic_img.height());
                                let should_resize =
                                    orig_w > target_max_dim || orig_h > target_max_dim;

                                let final_img = if should_resize {
                                    dynamic_img.thumbnail(target_max_dim, target_max_dim)
                                } else {
                                    dynamic_img
                                };

                                let mut recompressed_bytes = Vec::new();
                                let mut cursor = Cursor::new(&mut recompressed_bytes);
                                let mut encoder =
                                    image::codecs::jpeg::JpegEncoder::new_with_quality(
                                        &mut cursor,
                                        target_jpeg_quality,
                                    );

                                if encoder.encode_image(&final_img).is_ok()
                                    && recompressed_bytes.len() < stream.content.len()
                                {
                                    stream.set_plain_content(recompressed_bytes);
                                    stream
                                        .dict
                                        .set("Filter", Object::Name(b"DCTDecode".to_vec()));
                                    stream
                                        .dict
                                        .set("Width", Object::Integer(final_img.width() as i64));
                                    stream
                                        .dict
                                        .set("Height", Object::Integer(final_img.height() as i64));
                                    image_count_optimized += 1;
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if optimize_structure {
        doc.prune_objects();
        doc.compress();
    }

    let mut output_bytes = Vec::new();
    doc.save_to(&mut output_bytes)?;

    Ok((output_bytes, image_count_optimized))
}

pub fn compress_pdf(
    input_path: &Path,
    output_path: &Path,
    options: &PdfCompressionOptions,
) -> Result<PdfResultInfo> {
    let original_bytes = std::fs::metadata(input_path)?.len();
    let doc = Document::load(input_path)
        .map_err(|e| anyhow!("Impossible de lire le document PDF : {}", e))?;

    if doc.is_encrypted() {
        return Err(anyhow!("Le document PDF est protégé par mot de passe."));
    }

    let pages_count = doc.get_pages().len() as u32;

    let (final_bytes, image_count_optimized) = if let Some(target_kb) = options.target_size_kb {
        let target_bytes = (target_kb as u64) * 1024;

        // Step 1: Check if structure-only compression satisfies target size
        let (light_bytes, _) =
            compress_doc_internal(doc.clone(), 85, 2400, false, options.optimize_structure)?;

        if (light_bytes.len() as u64) <= target_bytes {
            (light_bytes, 0)
        } else {
            // Binary search across progressive tiers to minimize Document clones and re-encodings
            let tiers = [
                (85u8, 2000u32),
                (70u8, 1500u32),
                (55u8, 1100u32),
                (40u8, 850u32),
                (25u8, 650u32),
            ];

            let mut best_buf = light_bytes;
            let mut best_opt_count = 0;
            let mut low = 0;
            let mut high = tiers.len() - 1;

            while low <= high {
                let mid = (low + high) / 2;
                let (q, dim) = tiers[mid];
                if let Ok((tier_buf, count)) = compress_doc_internal(
                    doc.clone(),
                    q,
                    dim,
                    options.recompress_images,
                    options.optimize_structure,
                ) {
                    let len = tier_buf.len() as u64;
                    if len <= target_bytes {
                        best_buf = tier_buf;
                        best_opt_count = count;
                        if mid == 0 {
                            break;
                        }
                        high = mid - 1;
                    } else {
                        if tier_buf.len() < best_buf.len() {
                            best_buf = tier_buf;
                            best_opt_count = count;
                        }
                        low = mid + 1;
                    }
                } else {
                    break;
                }
            }

            (best_buf, best_opt_count)
        }
    } else {
        // Standard profile-based compression
        let (target_jpeg_quality, target_max_dim) = match options.profile {
            PdfCompressionProfile::Readable => (85u8, 2400u32),
            PdfCompressionProfile::Balanced => (70u8, 1600u32),
            PdfCompressionProfile::Compact => (50u8, 1000u32),
        };

        compress_doc_internal(
            doc,
            target_jpeg_quality,
            target_max_dim,
            options.recompress_images,
            options.optimize_structure,
        )?
    };

    std::fs::write(output_path, &final_bytes)?;

    let compressed_bytes = final_bytes.len() as u64;
    let saved_percentage = if original_bytes > 0 {
        let diff = (original_bytes as f64) - (compressed_bytes as f64);
        ((diff / (original_bytes as f64)) * 100.0).max(0.0) as f32
    } else {
        0.0
    };

    Ok(PdfResultInfo {
        original_bytes,
        compressed_bytes,
        saved_percentage,
        pages_count,
        image_count_optimized,
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PdfPreviewResponse {
    pub original_page_pdf_base64: String,
    pub compressed_page_pdf_base64: String,
    pub original_bytes: u64,
    pub estimated_bytes: u64,
    pub saved_percentage: f32,
    pub total_pages: u32,
}

fn extract_page_one_doc(mut doc: Document) -> Result<Document> {
    let page_count = doc.get_pages().len() as u32;
    if page_count > 1 {
        let to_delete: Vec<u32> = (2..=page_count).collect();
        doc.delete_pages(&to_delete);
        doc.prune_objects();
    }
    Ok(doc)
}

pub fn generate_pdf_preview(
    input_path: &Path,
    options: &PdfCompressionOptions,
) -> Result<PdfPreviewResponse> {
    let original_bytes = std::fs::metadata(input_path)?.len();
    let doc = Document::load(input_path)
        .map_err(|e| anyhow!("Impossible de lire le document PDF : {}", e))?;

    if doc.is_encrypted() {
        return Err(anyhow!("Le document PDF est protégé par mot de passe."));
    }

    let total_pages = doc.get_pages().len() as u32;
    if total_pages == 0 {
        return Err(anyhow!("Le document PDF ne contient aucune page valide."));
    }

    // Extract Page 1 for original rendering
    let mut orig_page_doc = extract_page_one_doc(doc)?;
    let mut orig_page_bytes = Vec::new();
    orig_page_doc.save_to(&mut orig_page_bytes)?;

    let (target_jpeg_quality, target_max_dim, estimated_ratio) =
        if let Some(target_kb) = options.target_size_kb {
            let target_bytes = (target_kb as u64) * 1024;
            let ratio = if original_bytes > 0 {
                (target_bytes as f64) / (original_bytes as f64)
            } else {
                1.0
            };
            let (q, dim) = if ratio >= 0.8 {
                (85u8, 2000u32)
            } else if ratio >= 0.6 {
                (70u8, 1500u32)
            } else if ratio >= 0.45 {
                (55u8, 1100u32)
            } else if ratio >= 0.3 {
                (40u8, 850u32)
            } else {
                (25u8, 650u32)
            };
            (q, dim, ratio.min(1.0))
        } else {
            match options.profile {
                PdfCompressionProfile::Readable => (85u8, 2400u32, 0.75),
                PdfCompressionProfile::Balanced => (70u8, 1600u32, 0.55),
                PdfCompressionProfile::Compact => (50u8, 1000u32, 0.35),
            }
        };

    let (compressed_page_bytes, _) = compress_doc_internal(
        orig_page_doc,
        target_jpeg_quality,
        target_max_dim,
        options.recompress_images,
        options.optimize_structure,
    )?;

    let estimated_bytes = if let Some(target_kb) = options.target_size_kb {
        std::cmp::min(original_bytes, (target_kb as u64) * 1024)
    } else {
        ((original_bytes as f64) * estimated_ratio).round() as u64
    };

    let saved_percentage = if original_bytes > 0 && original_bytes > estimated_bytes {
        let diff = (original_bytes - estimated_bytes) as f64;
        ((diff / (original_bytes as f64)) * 100.0).max(0.0) as f32
    } else {
        0.0
    };

    Ok(PdfPreviewResponse {
        original_page_pdf_base64: BASE64.encode(&orig_page_bytes),
        compressed_page_pdf_base64: BASE64.encode(&compressed_page_bytes),
        original_bytes,
        estimated_bytes,
        saved_percentage,
        total_pages,
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PdfDocumentInfo {
    pub path: String,
    pub total_pages: u32,
    pub file_size_bytes: u64,
}

pub fn get_pdf_info(path: &Path) -> Result<PdfDocumentInfo> {
    let file_size_bytes = std::fs::metadata(path)?.len();
    let doc = Document::load(path)?;
    let total_pages = doc.get_pages().len() as u32;

    Ok(PdfDocumentInfo {
        path: path.to_string_lossy().to_string(),
        total_pages,
        file_size_bytes,
    })
}

fn remap_object_references(obj: &mut Object, id_map: &HashMap<(u32, u16), (u32, u16)>) {
    match obj {
        Object::Reference(id) => {
            if let Some(&new_id) = id_map.get(id) {
                *id = new_id;
            }
        }
        Object::Array(arr) => {
            for item in arr.iter_mut() {
                remap_object_references(item, id_map);
            }
        }
        Object::Dictionary(dict) => {
            for (_, val) in dict.iter_mut() {
                remap_object_references(val, id_map);
            }
        }
        Object::Stream(stream) => {
            for (_, val) in stream.dict.iter_mut() {
                remap_object_references(val, id_map);
            }
        }
        _ => {}
    }
}

pub fn merge_pdfs(input_paths: &[PathBuf], output_path: &Path) -> Result<PdfResultInfo> {
    if input_paths.is_empty() {
        return Err(anyhow!("Aucun fichier PDF spécifié pour la fusion."));
    }

    let mut total_original_bytes: u64 = 0;
    let mut merged_doc = Document::with_version("1.5");
    let pages_id = merged_doc.new_object_id();
    let catalog_id = merged_doc.new_object_id();
    let mut accumulated_page_ids: Vec<Object> = Vec::new();

    for path in input_paths {
        let meta = std::fs::metadata(path)?;
        total_original_bytes += meta.len();

        let mut doc = Document::load(path)
            .map_err(|e| anyhow!("Erreur lors de la lecture de {:?} : {}", path, e))?;

        if doc.is_encrypted() {
            return Err(anyhow!(
                "Le document {:?} est protégé par mot de passe.",
                path
            ));
        }

        doc.renumber_objects();
        let pages = doc.get_pages();
        let page_object_ids: HashSet<(u32, u16)> = pages.values().cloned().collect();

        let mut id_map: HashMap<(u32, u16), (u32, u16)> = HashMap::new();
        for &old_id in doc.objects.keys() {
            id_map.insert(old_id, merged_doc.new_object_id());
        }

        for &page_old_id in pages.values() {
            if let Some(&new_id) = id_map.get(&page_old_id) {
                accumulated_page_ids.push(Object::Reference(new_id));
            }
        }

        for (old_id, mut obj) in doc.objects {
            let new_id = id_map[&old_id];
            remap_object_references(&mut obj, &id_map);

            if page_object_ids.contains(&old_id) {
                if let Ok(dict) = obj.as_dict_mut() {
                    dict.set("Parent", pages_id);
                }
            }

            merged_doc.objects.insert(new_id, obj);
        }
    }

    let total_pages = accumulated_page_ids.len() as u32;

    let mut pages_dict = lopdf::Dictionary::new();
    pages_dict.set("Type", "Pages");
    pages_dict.set("Kids", accumulated_page_ids);
    pages_dict.set("Count", Object::Integer(total_pages as i64));
    merged_doc
        .objects
        .insert(pages_id, Object::Dictionary(pages_dict));

    let mut catalog_dict = lopdf::Dictionary::new();
    catalog_dict.set("Type", "Catalog");
    catalog_dict.set("Pages", pages_id);
    merged_doc
        .objects
        .insert(catalog_id, Object::Dictionary(catalog_dict));

    merged_doc.trailer.set("Root", catalog_id);
    merged_doc.renumber_objects();
    merged_doc.adjust_zero_pages();
    merged_doc.compress();

    if let Some(parent) = output_path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    merged_doc.save(output_path)?;
    let final_bytes = std::fs::metadata(output_path)?.len();

    let saved_percentage = if total_original_bytes > 0 && total_original_bytes > final_bytes {
        let diff = (total_original_bytes - final_bytes) as f64;
        ((diff / (total_original_bytes as f64)) * 100.0).max(0.0) as f32
    } else {
        0.0
    };

    Ok(PdfResultInfo {
        original_bytes: total_original_bytes,
        compressed_bytes: final_bytes,
        saved_percentage,
        pages_count: total_pages,
        image_count_optimized: 0,
    })
}

pub fn extract_pdf_pages(
    input_path: &Path,
    pages_to_keep: &[u32],
    output_path: &Path,
) -> Result<PdfResultInfo> {
    if pages_to_keep.is_empty() {
        return Err(anyhow!("Aucune page sélectionnée pour l'extraction."));
    }

    let original_bytes = std::fs::metadata(input_path)?.len();
    let mut doc = Document::load(input_path)
        .map_err(|e| anyhow!("Impossible de lire le document PDF : {}", e))?;

    if doc.is_encrypted() {
        return Err(anyhow!("Le document PDF est protégé par mot de passe."));
    }

    let total_pages = doc.get_pages().len() as u32;

    let valid_pages: HashSet<u32> = pages_to_keep
        .iter()
        .cloned()
        .filter(|&p| p >= 1 && p <= total_pages)
        .collect();

    if valid_pages.is_empty() {
        return Err(anyhow!(
            "Les pages sélectionnées sont hors limites (1 à {}).",
            total_pages
        ));
    }

    let to_delete: Vec<u32> = (1..=total_pages)
        .filter(|p| !valid_pages.contains(p))
        .collect();

    if !to_delete.is_empty() && to_delete.len() < total_pages as usize {
        doc.delete_pages(&to_delete);
        doc.prune_objects();
        doc.renumber_objects();
        doc.adjust_zero_pages();
        doc.compress();
    }

    if let Some(parent) = output_path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    doc.save(output_path)?;
    let final_bytes = std::fs::metadata(output_path)?.len();
    let final_pages_count = valid_pages.len() as u32;

    let saved_percentage = if original_bytes > 0 && original_bytes > final_bytes {
        let diff = (original_bytes - final_bytes) as f64;
        ((diff / (original_bytes as f64)) * 100.0).max(0.0) as f32
    } else {
        0.0
    };

    Ok(PdfResultInfo {
        original_bytes,
        compressed_bytes: final_bytes,
        saved_percentage,
        pages_count: final_pages_count,
        image_count_optimized: 0,
    })
}

pub fn split_pdf_all(
    input_path: &Path,
    output_dir: &Path,
    base_name: &str,
) -> Result<Vec<PathBuf>> {
    let doc = Document::load(input_path)
        .map_err(|e| anyhow!("Impossible de lire le document PDF : {}", e))?;

    if doc.is_encrypted() {
        return Err(anyhow!("Le document PDF est protégé par mot de passe."));
    }

    let total_pages = doc.get_pages().len() as u32;
    if total_pages == 0 {
        return Err(anyhow!("Le document ne contient aucune page."));
    }

    std::fs::create_dir_all(output_dir)?;
    let mut generated_files = Vec::with_capacity(total_pages as usize);

    for page_num in 1..=total_pages {
        let mut single_page_doc = doc.clone();
        let to_delete: Vec<u32> = (1..=total_pages).filter(|&p| p != page_num).collect();
        if !to_delete.is_empty() {
            single_page_doc.delete_pages(&to_delete);
            single_page_doc.prune_objects();
            single_page_doc.renumber_objects();
            single_page_doc.adjust_zero_pages();
            single_page_doc.compress();
        }

        let out_filename = format!("{}_page_{}.pdf", base_name, page_num);
        let out_file_path = output_dir.join(out_filename);
        single_page_doc.save(&out_file_path)?;
        generated_files.push(out_file_path);
    }

    Ok(generated_files)
}

pub fn parse_page_ranges(input: &str, total_pages: u32) -> Vec<u32> {
    let mut pages = BTreeSet::new();
    let normalized = input.to_lowercase().replace(';', ",");

    for part in normalized.split([',', ' ']) {
        let trimmed = part.trim();
        if trimmed.is_empty() {
            continue;
        }

        if trimmed == "pairs" || trimmed == "even" {
            for p in (2..=total_pages).step_by(2) {
                pages.insert(p);
            }
            continue;
        }

        if trimmed == "impairs" || trimmed == "odd" {
            for p in (1..=total_pages).step_by(2) {
                pages.insert(p);
            }
            continue;
        }

        if trimmed == "toutes" || trimmed == "all" || trimmed == "*" {
            for p in 1..=total_pages {
                pages.insert(p);
            }
            continue;
        }

        if let Some((start_s, end_s)) = trimmed.split_once('-') {
            let start = start_s.trim().parse::<u32>().unwrap_or(1);
            let end = if end_s.trim() == "fin" || end_s.trim() == "end" {
                total_pages
            } else {
                end_s.trim().parse::<u32>().unwrap_or(total_pages)
            };
            let (from, to) = if start <= end {
                (start, end)
            } else {
                (end, start)
            };
            for p in from..=to {
                if p >= 1 && p <= total_pages {
                    pages.insert(p);
                }
            }
        } else if let Ok(single) = trimmed.parse::<u32>() {
            if single >= 1 && single <= total_pages {
                pages.insert(single);
            }
        }
    }

    pages.into_iter().collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE_PDF_BYTES: &[u8] = b"%PDF-1.5
1 0 obj<</Type/Pages/Kids[5 0 R]/Count 1/Resources 3 0 R/MediaBox[0 0 595 842]>>endobj
2 0 obj<</Type/Font/Subtype/Type1/BaseFont/Courier>>endobj
3 0 obj<</Font<</F1 2 0 R>>>>endobj
4 0 obj<</Length 45>>stream
BT
/F1 48 Tf
100 600 Td
(Hello World!) Tj
ET
endstream endobj
5 0 obj<</Type/Page/Parent 1 0 R/Contents[4 0 R]>>endobj
6 0 obj<</Type/Catalog/Pages 1 0 R>>endobj
xref
0 7
0000000000 65535 f 
0000000009 00000 n 
0000000096 00000 n 
0000000155 00000 n 
0000000191 00000 n 
0000000281 00000 n 
0000000338 00000 n 
trailer
<</Root 6 0 R/Size 7>>
startxref
381
%%EOF
";

    struct TempFileCleaner(std::path::PathBuf);
    impl Drop for TempFileCleaner {
        fn drop(&mut self) {
            let _ = std::fs::remove_file(&self.0);
        }
    }

    fn create_temp_sample_pdf() -> (std::path::PathBuf, TempFileCleaner) {
        let unique_id = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        let temp_path =
            std::env::temp_dir().join(format!("filemint_test_sample_{}.pdf", unique_id));
        std::fs::write(&temp_path, SAMPLE_PDF_BYTES).expect("Failed to write temp test PDF");
        (temp_path.clone(), TempFileCleaner(temp_path))
    }

    #[test]
    fn test_extract_page_one() {
        let mut doc = Document::load_mem(SAMPLE_PDF_BYTES).expect("Failed to parse sample PDF");
        // Duplicate the page to make it a 2-page document
        let pages = doc.get_pages();
        let page1_id = *pages.get(&1).unwrap();
        let catalog_id = doc.trailer.get(b"Root").unwrap().as_reference().unwrap();
        let catalog = doc.get_object(catalog_id).unwrap().as_dict().unwrap();
        let pages_id = catalog.get(b"Pages").unwrap().as_reference().unwrap();

        let page2_id = doc.add_object(doc.get_object(page1_id).unwrap().clone());
        let pages_obj = doc.get_object_mut(pages_id).unwrap().as_dict_mut().unwrap();
        let mut kids = pages_obj.get(b"Kids").unwrap().as_array().unwrap().clone();
        kids.push(Object::Reference(page2_id));
        pages_obj.set("Kids", Object::Array(kids));
        pages_obj.set("Count", Object::Integer(2));

        assert_eq!(doc.get_pages().len(), 2);

        // Now test page extraction logic:
        let page_count = doc.get_pages().len() as u32;
        if page_count > 1 {
            let to_delete: Vec<u32> = (2..=page_count).collect();
            doc.delete_pages(&to_delete);
            doc.prune_objects();
        }
        assert_eq!(doc.get_pages().len(), 1);

        let mut out = Vec::new();
        doc.save_to(&mut out).unwrap();
        let doc2 = Document::load_mem(&out).unwrap();
        assert_eq!(doc2.get_pages().len(), 1);
    }

    #[test]
    fn test_generate_pdf_preview() {
        let (temp_path, _cleaner) = create_temp_sample_pdf();
        let opts = PdfCompressionOptions::default();
        let preview = generate_pdf_preview(&temp_path, &opts).unwrap();
        assert_eq!(preview.total_pages, 1);
        assert!(!preview.original_page_pdf_base64.is_empty());
        assert!(!preview.compressed_page_pdf_base64.is_empty());
        assert!(preview.estimated_bytes > 0);
    }

    #[test]
    fn test_merge_pdfs() {
        let (temp1, _cleaner1) = create_temp_sample_pdf();
        let (temp2, _cleaner2) = create_temp_sample_pdf();

        let out_path = std::env::temp_dir().join(format!(
            "filemint_test_merge_{}.pdf",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0)
        ));
        let _cleaner_out = TempFileCleaner(out_path.clone());

        let result = merge_pdfs(&[temp1, temp2], &out_path).unwrap();
        assert_eq!(result.pages_count, 2);
        assert!(result.compressed_bytes > 0);
        assert!(out_path.exists());

        let merged_doc = Document::load(&out_path).unwrap();
        assert_eq!(merged_doc.get_pages().len(), 2);
    }

    #[test]
    fn test_extract_pdf_pages_function() {
        let (temp1, _cleaner1) = create_temp_sample_pdf();
        let (temp2, _cleaner2) = create_temp_sample_pdf();

        let merged_path = std::env::temp_dir().join(format!(
            "filemint_test_merged_for_extract_{}.pdf",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0)
        ));
        let _cleaner_merged = TempFileCleaner(merged_path.clone());
        let _ = merge_pdfs(&[temp1, temp2], &merged_path).unwrap();

        let extract_out = std::env::temp_dir().join(format!(
            "filemint_test_extracted_{}.pdf",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0)
        ));
        let _cleaner_extract = TempFileCleaner(extract_out.clone());

        // Extract page 2 only
        let res = extract_pdf_pages(&merged_path, &[2], &extract_out).unwrap();
        assert_eq!(res.pages_count, 1);
        let extracted_doc = Document::load(&extract_out).unwrap();
        assert_eq!(extracted_doc.get_pages().len(), 1);
    }

    #[test]
    fn test_split_pdf_all() {
        let (temp1, _cleaner1) = create_temp_sample_pdf();
        let (temp2, _cleaner2) = create_temp_sample_pdf();

        let merged_path = std::env::temp_dir().join(format!(
            "filemint_test_merged_for_split_{}.pdf",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0)
        ));
        let _cleaner_merged = TempFileCleaner(merged_path.clone());
        let _ = merge_pdfs(&[temp1, temp2], &merged_path).unwrap();

        let split_dir = std::env::temp_dir().join(format!(
            "filemint_test_split_dir_{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0)
        ));
        let files = split_pdf_all(&merged_path, &split_dir, "document").unwrap();
        assert_eq!(files.len(), 2);
        for f in &files {
            assert!(f.exists());
            let doc = Document::load(f).unwrap();
            assert_eq!(doc.get_pages().len(), 1);
            let _ = std::fs::remove_file(f);
        }
        let _ = std::fs::remove_dir(&split_dir);
    }

    #[test]
    fn test_parse_page_ranges() {
        assert_eq!(parse_page_ranges("1-3, 5", 10), vec![1, 2, 3, 5]);
        assert_eq!(parse_page_ranges("pairs", 6), vec![2, 4, 6]);
        assert_eq!(parse_page_ranges("impairs", 6), vec![1, 3, 5]);
        assert_eq!(parse_page_ranges("2-fin", 5), vec![2, 3, 4, 5]);
        assert_eq!(parse_page_ranges("100", 5), Vec::<u32>::new());
    }

    #[test]
    fn test_get_pdf_info() {
        let (temp_path, _cleaner) = create_temp_sample_pdf();
        let info = get_pdf_info(&temp_path).unwrap();
        assert_eq!(info.total_pages, 1);
        assert!(info.file_size_bytes > 0);
    }
}
