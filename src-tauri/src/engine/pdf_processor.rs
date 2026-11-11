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

fn get_stream_image_bytes(stream: &lopdf::Stream) -> Option<std::borrow::Cow<'_, [u8]>> {
    // 1. Try standard decompression (handles FlateDecode, LZWDecode, ASCII85, etc.)
    if let Ok(decompressed) = stream.decompressed_content() {
        return Some(std::borrow::Cow::Owned(decompressed));
    }

    // 2. If lopdf fails on DCTDecode (JPEG) or unhandled filter:
    // In PDF, DCTDecode streams contain raw JPEG bytes directly in `stream.content`.
    let is_dct = stream
        .dict
        .get(b"Filter")
        .is_ok_and(|filter_obj| match filter_obj {
            Object::Name(name) => name == b"DCTDecode",
            Object::Array(arr) => arr
                .iter()
                .any(|item| item.as_name().is_ok_and(|n| n == b"DCTDecode")),
            _ => false,
        })
        || stream.content.starts_with(&[0xFF, 0xD8]);

    if is_dct && !stream.content.is_empty() {
        return Some(std::borrow::Cow::Borrowed(&stream.content));
    }

    None
}

fn is_image_pure_grayscale(img: &image::DynamicImage) -> bool {
    match img {
        image::DynamicImage::ImageLuma8(_) | image::DynamicImage::ImageLuma16(_) => true,
        image::DynamicImage::ImageRgb8(rgb) => {
            let (chunks, _) = rgb.as_raw().as_chunks::<3>();
            if chunks.is_empty() {
                return false;
            }
            let step = (chunks.len() / 50).clamp(1, 100);
            for chunk in chunks.iter().step_by(step) {
                if chunk[0] != chunk[1] || chunk[1] != chunk[2] {
                    return false;
                }
            }
            true
        }
        image::DynamicImage::ImageRgba8(rgba) => {
            let (chunks, _) = rgba.as_raw().as_chunks::<4>();
            if chunks.is_empty() {
                return false;
            }
            let step = (chunks.len() / 50).clamp(1, 100);
            for chunk in chunks.iter().step_by(step) {
                if chunk[0] != chunk[1] || chunk[1] != chunk[2] {
                    return false;
                }
            }
            true
        }
        _ => false,
    }
}

fn compress_doc_internal(
    mut doc: Document,
    target_jpeg_quality: u8,
    target_max_dim: u32,
    recompress_images: bool,
    optimize_structure: bool,
    recompress_flate: bool,
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
                    let has_smask =
                        stream.dict.get(b"SMask").is_ok() || stream.dict.get(b"Mask").is_ok();
                    let orig_is_gray = stream
                        .dict
                        .get(b"ColorSpace")
                        .is_ok_and(|cs| cs.as_name().is_ok_and(|n| n == b"DeviceGray"));

                    if let Some(image_data) = get_stream_image_bytes(stream) {
                        if let Ok(dynamic_img) = image::load_from_memory(&image_data) {
                            let (orig_w, orig_h) = (dynamic_img.width(), dynamic_img.height());
                            // Do not alter spatial dimensions if image relies on an SMask transparency mask
                            let should_resize =
                                !has_smask && (orig_w > target_max_dim || orig_h > target_max_dim);

                            let resized_img = if should_resize {
                                dynamic_img.thumbnail(target_max_dim, target_max_dim)
                            } else {
                                dynamic_img
                            };

                            let is_grayscale = orig_is_gray
                                || resized_img.color() == image::ColorType::L8
                                || is_image_pure_grayscale(&resized_img);

                            let (final_img, colorspace_name) = if is_grayscale {
                                (
                                    image::DynamicImage::ImageLuma8(resized_img.to_luma8()),
                                    b"DeviceGray".as_slice(),
                                )
                            } else {
                                (
                                    image::DynamicImage::ImageRgb8(resized_img.to_rgb8()),
                                    b"DeviceRGB".as_slice(),
                                )
                            };

                            let mut recompressed_bytes = Vec::new();
                            let mut cursor = Cursor::new(&mut recompressed_bytes);
                            let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(
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
                                stream
                                    .dict
                                    .set("ColorSpace", Object::Name(colorspace_name.to_vec()));
                                stream.dict.set("BitsPerComponent", Object::Integer(8));
                                image_count_optimized += 1;
                            }
                        }
                    }
                }
            }
        }
    }

    if optimize_structure {
        // Strip embedded page thumbnails (/Thumb) so they get garbage-collected by prune_objects
        let page_ids: Vec<lopdf::ObjectId> = doc.get_pages().values().cloned().collect();
        for page_id in page_ids {
            if let Ok(Object::Dictionary(ref mut dict)) = doc.get_object_mut(page_id) {
                dict.remove(b"Thumb");
            }
        }

        doc.prune_objects();
        if recompress_flate {
            doc.compress();
        }
    }

    let mut output_bytes = Vec::new();
    doc.save_to(&mut output_bytes)?;

    Ok((output_bytes, image_count_optimized))
}

fn ensure_document_decrypted(doc: &mut Document) -> Result<()> {
    if doc.is_encrypted() && doc.decrypt(b"").is_err() {
        return Err(anyhow!("Le document PDF est protégé par mot de passe."));
    }
    Ok(())
}

pub fn compress_pdf(
    input_path: &Path,
    output_path: &Path,
    options: &PdfCompressionOptions,
) -> Result<PdfResultInfo> {
    let original_bytes = std::fs::metadata(input_path)?.len();
    let mut doc = Document::load(input_path)
        .map_err(|e| anyhow!("Impossible de lire le document PDF : {}", e))?;

    ensure_document_decrypted(&mut doc)?;

    let pages_count = doc.get_pages().len() as u32;

    let (final_bytes, image_count_optimized) = if let Some(target_kb) = options.target_size_kb {
        let target_bytes = (target_kb as u64) * 1024;

        // Fast-path: If the file is already within the target size, run a single structure optimization pass.
        if original_bytes <= target_bytes {
            compress_doc_internal(doc, 85, 2400, false, options.optimize_structure, true)?
        } else {
            let tiers = [
                (85u8, 2000u32),
                (70u8, 1500u32),
                (55u8, 1100u32),
                (40u8, 850u32),
                (25u8, 650u32),
            ];

            // If target is very close to original (>= 90%), test if structure-only compression suffices
            let structure_only_suffices = if target_bytes >= (original_bytes * 9 / 10) {
                if let Ok((light_bytes, _)) = compress_doc_internal(
                    doc.clone(),
                    85,
                    2400,
                    false,
                    options.optimize_structure,
                    true,
                ) {
                    if (light_bytes.len() as u64) <= target_bytes {
                        Some(light_bytes)
                    } else {
                        None
                    }
                } else {
                    None
                }
            } else {
                None
            };

            if let Some(light_bytes) = structure_only_suffices {
                (light_bytes, 0)
            } else {
                // Binary search across progressive tiers using ultra-fast probes (recompress_flate = false)
                let mut best_tier_index: Option<usize> = None;
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
                        false, // Fast probe without full Zlib Flate recompression
                    ) {
                        let len = tier_buf.len() as u64;

                        // If no images could be optimized at all, further image quality tiers won't help
                        if count == 0 {
                            break;
                        }

                        if len <= target_bytes {
                            best_tier_index = Some(mid);
                            if mid == 0 {
                                break;
                            }
                            high = mid - 1;
                        } else {
                            if best_tier_index.is_none() {
                                best_tier_index = Some(mid);
                            }
                            low = mid + 1;
                        }
                    } else {
                        break;
                    }
                }

                // Apply full final compression (with recompress_flate = true) once on the selected winning tier
                let (final_q, final_dim) = match best_tier_index {
                    Some(idx) => tiers[idx],
                    None => (tiers.last().unwrap().0, tiers.last().unwrap().1),
                };

                compress_doc_internal(
                    doc,
                    final_q,
                    final_dim,
                    options.recompress_images,
                    options.optimize_structure,
                    true, // Single final full Flate pass
                )?
            }
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
            true,
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
    }
    doc.prune_objects();
    Ok(doc)
}

pub fn generate_pdf_preview(
    input_path: &Path,
    options: &PdfCompressionOptions,
) -> Result<PdfPreviewResponse> {
    let original_bytes = std::fs::metadata(input_path)?.len();
    let mut doc = Document::load(input_path)
        .map_err(|e| anyhow!("Impossible de lire le document PDF : {}", e))?;

    ensure_document_decrypted(&mut doc)?;

    let total_pages = doc.get_pages().len() as u32;
    if total_pages == 0 {
        return Err(anyhow!("Le document PDF ne contient aucune page valide."));
    }

    // Extract Page 1 for original rendering:
    // If single page, read raw bytes directly from disk to preserve 100% fidelity without re-serialization.
    let (orig_page_bytes, doc_to_compress) = if total_pages == 1 {
        let raw = std::fs::read(input_path)?;
        (raw, doc)
    } else {
        let mut orig_doc = extract_page_one_doc(doc)?;
        let mut bytes = Vec::new();
        orig_doc.save_to(&mut bytes)?;
        let comp_doc = orig_doc.clone();
        (bytes, comp_doc)
    };

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

    let (compressed_page_bytes, image_count_optimized) = match compress_doc_internal(
        doc_to_compress,
        target_jpeg_quality,
        target_max_dim,
        options.recompress_images,
        options.optimize_structure,
        false,
    ) {
        Ok((bytes, count)) => (bytes, count),
        Err(_) => (orig_page_bytes.clone(), 0),
    };

    let effective_ratio = if let Some(target_kb) = options.target_size_kb {
        let target_bytes = (target_kb as u64) * 1024;
        if original_bytes > 0 {
            ((target_bytes as f64) / (original_bytes as f64)).min(1.0)
        } else {
            1.0
        }
    } else if total_pages == 1 {
        if !orig_page_bytes.is_empty() {
            ((compressed_page_bytes.len() as f64) / (orig_page_bytes.len() as f64)).clamp(0.05, 1.0)
        } else {
            estimated_ratio
        }
    } else {
        // Multi-page document:
        // If Page 1 had compressible images and reduced in size, use its measured ratio.
        // Otherwise (cover/text page without images), use the profile expected ratio.
        if image_count_optimized > 0
            && !orig_page_bytes.is_empty()
            && compressed_page_bytes.len() < orig_page_bytes.len()
        {
            ((compressed_page_bytes.len() as f64) / (orig_page_bytes.len() as f64)).clamp(0.05, 1.0)
        } else {
            estimated_ratio
        }
    };

    let estimated_bytes = if let Some(target_kb) = options.target_size_kb {
        std::cmp::min(original_bytes, (target_kb as u64) * 1024)
    } else {
        ((original_bytes as f64) * effective_ratio)
            .round()
            .min(original_bytes as f64) as u64
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
    let mut doc = Document::load(path)?;
    let _ = ensure_document_decrypted(&mut doc);
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

        ensure_document_decrypted(&mut doc)
            .map_err(|_| anyhow!("Le document {:?} est protégé par mot de passe.", path))?;

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

    ensure_document_decrypted(&mut doc)?;

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
    let mut doc = Document::load(input_path)
        .map_err(|e| anyhow!("Impossible de lire le document PDF : {}", e))?;

    ensure_document_decrypted(&mut doc)?;

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

    #[test]
    fn test_compress_pdf_with_dct_images() {
        let img = image::RgbImage::from_fn(300, 300, |x, y| {
            image::Rgb([(x % 256) as u8, (y % 256) as u8, 128])
        });
        let mut jpeg_data = Vec::new();
        image::codecs::jpeg::JpegEncoder::new_with_quality(&mut jpeg_data, 95)
            .encode_image(&img)
            .unwrap();

        let mut doc = Document::with_version("1.5");
        let pages_id = doc.new_object_id();
        let page_id = doc.new_object_id();
        let content_id = doc.new_object_id();
        let image_id = doc.new_object_id();

        let mut image_dict = lopdf::Dictionary::new();
        image_dict.set("Type", Object::Name(b"XObject".to_vec()));
        image_dict.set("Subtype", Object::Name(b"Image".to_vec()));
        image_dict.set("Width", Object::Integer(300));
        image_dict.set("Height", Object::Integer(300));
        image_dict.set("ColorSpace", Object::Name(b"DeviceRGB".to_vec()));
        image_dict.set("BitsPerComponent", Object::Integer(8));
        image_dict.set("Filter", Object::Name(b"DCTDecode".to_vec()));
        let image_stream = lopdf::Stream::new(image_dict, jpeg_data);
        doc.objects.insert(image_id, Object::Stream(image_stream));

        let content_stream = lopdf::Stream::new(
            lopdf::Dictionary::new(),
            b"q 300 0 0 300 0 0 cm /Im1 Do Q".to_vec(),
        );
        doc.objects
            .insert(content_id, Object::Stream(content_stream));

        let mut xobjects = lopdf::Dictionary::new();
        xobjects.set("Im1", Object::Reference(image_id));
        let mut resources = lopdf::Dictionary::new();
        resources.set("XObject", Object::Dictionary(xobjects));

        let mut page_dict = lopdf::Dictionary::new();
        page_dict.set("Type", Object::Name(b"Page".to_vec()));
        page_dict.set("Parent", Object::Reference(pages_id));
        page_dict.set("Contents", Object::Reference(content_id));
        page_dict.set("Resources", Object::Dictionary(resources));
        page_dict.set(
            "MediaBox",
            Object::Array(vec![
                Object::Integer(0),
                Object::Integer(0),
                Object::Integer(600),
                Object::Integer(800),
            ]),
        );
        doc.objects.insert(page_id, Object::Dictionary(page_dict));

        let mut pages_dict = lopdf::Dictionary::new();
        pages_dict.set("Type", Object::Name(b"Pages".to_vec()));
        pages_dict.set("Kids", Object::Array(vec![Object::Reference(page_id)]));
        pages_dict.set("Count", Object::Integer(1));
        doc.objects.insert(pages_id, Object::Dictionary(pages_dict));

        let mut catalog = lopdf::Dictionary::new();
        catalog.set("Type", Object::Name(b"Catalog".to_vec()));
        catalog.set("Pages", Object::Reference(pages_id));
        let catalog_id = doc.add_object(Object::Dictionary(catalog));
        doc.trailer.set("Root", Object::Reference(catalog_id));

        let temp_in = std::env::temp_dir().join(format!(
            "test_pdf_dct_in_{}.pdf",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let temp_out = std::env::temp_dir().join(format!(
            "test_pdf_dct_out_{}.pdf",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let _c1 = TempFileCleaner(temp_in.clone());
        let _c2 = TempFileCleaner(temp_out.clone());

        doc.save(&temp_in).unwrap();

        let options = PdfCompressionOptions {
            profile: PdfCompressionProfile::Compact,
            optimize_structure: true,
            recompress_images: true,
            target_size_kb: None,
        };

        let result = compress_pdf(&temp_in, &temp_out, &options).unwrap();
        assert!(
            result.image_count_optimized >= 1,
            "Image should have been optimized!"
        );
        assert!(
            result.compressed_bytes < result.original_bytes,
            "Output should be smaller than input!"
        );
    }

    #[test]
    fn test_compress_pdf_grayscale_devicegray() {
        let img = image::GrayImage::from_fn(250, 250, |x, y| image::Luma([((x + y) % 256) as u8]));
        let mut jpeg_data = Vec::new();
        image::codecs::jpeg::JpegEncoder::new_with_quality(&mut jpeg_data, 95)
            .encode_image(&img)
            .unwrap();

        let mut doc = Document::with_version("1.5");
        let pages_id = doc.new_object_id();
        let page_id = doc.new_object_id();
        let image_id = doc.new_object_id();

        let mut image_dict = lopdf::Dictionary::new();
        image_dict.set("Type", Object::Name(b"XObject".to_vec()));
        image_dict.set("Subtype", Object::Name(b"Image".to_vec()));
        image_dict.set("Width", Object::Integer(250));
        image_dict.set("Height", Object::Integer(250));
        image_dict.set("ColorSpace", Object::Name(b"DeviceGray".to_vec()));
        image_dict.set("BitsPerComponent", Object::Integer(8));
        image_dict.set("Filter", Object::Name(b"DCTDecode".to_vec()));
        let image_stream = lopdf::Stream::new(image_dict, jpeg_data);
        doc.objects.insert(image_id, Object::Stream(image_stream));

        let mut xobjects = lopdf::Dictionary::new();
        xobjects.set("ImGray", Object::Reference(image_id));
        let mut resources = lopdf::Dictionary::new();
        resources.set("XObject", Object::Dictionary(xobjects));

        let mut page_dict = lopdf::Dictionary::new();
        page_dict.set("Type", Object::Name(b"Page".to_vec()));
        page_dict.set("Parent", Object::Reference(pages_id));
        page_dict.set("Resources", Object::Dictionary(resources));
        page_dict.set(
            "MediaBox",
            Object::Array(vec![
                Object::Integer(0),
                Object::Integer(0),
                Object::Integer(500),
                Object::Integer(500),
            ]),
        );
        doc.objects.insert(page_id, Object::Dictionary(page_dict));

        let mut pages_dict = lopdf::Dictionary::new();
        pages_dict.set("Type", Object::Name(b"Pages".to_vec()));
        pages_dict.set("Kids", Object::Array(vec![Object::Reference(page_id)]));
        pages_dict.set("Count", Object::Integer(1));
        doc.objects.insert(pages_id, Object::Dictionary(pages_dict));

        let mut catalog = lopdf::Dictionary::new();
        catalog.set("Type", Object::Name(b"Catalog".to_vec()));
        catalog.set("Pages", Object::Reference(pages_id));
        let catalog_id = doc.add_object(Object::Dictionary(catalog));
        doc.trailer.set("Root", Object::Reference(catalog_id));

        let temp_in = std::env::temp_dir().join(format!(
            "test_gray_in_{}.pdf",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let temp_out = std::env::temp_dir().join(format!(
            "test_gray_out_{}.pdf",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let _c1 = TempFileCleaner(temp_in.clone());
        let _c2 = TempFileCleaner(temp_out.clone());

        doc.save(&temp_in).unwrap();

        let options = PdfCompressionOptions {
            profile: PdfCompressionProfile::Compact,
            optimize_structure: true,
            recompress_images: true,
            target_size_kb: None,
        };

        let result = compress_pdf(&temp_in, &temp_out, &options).unwrap();
        assert!(result.image_count_optimized >= 1);

        // Verify output preserves DeviceGray
        let reloaded = Document::load(&temp_out).unwrap();
        let out_img = reloaded
            .objects
            .get(&image_id)
            .unwrap()
            .as_stream()
            .unwrap();
        let cs = out_img.dict.get(b"ColorSpace").unwrap().as_name().unwrap();
        assert_eq!(cs, b"DeviceGray");
    }

    #[test]
    fn test_strip_page_thumbnails() {
        let (temp_path, _cleaner) = create_temp_sample_pdf();
        let mut doc = Document::load(&temp_path).unwrap();

        // Add a fake thumbnail object
        let thumb_id = doc.new_object_id();
        let thumb_stream = lopdf::Stream::new(lopdf::Dictionary::new(), vec![1, 2, 3, 4]);
        doc.objects.insert(thumb_id, Object::Stream(thumb_stream));

        let page_id = doc.get_pages().into_values().next().unwrap();
        if let Ok(Object::Dictionary(ref mut dict)) = doc.get_object_mut(page_id) {
            dict.set("Thumb", Object::Reference(thumb_id));
        }

        let temp_with_thumb = std::env::temp_dir().join(format!(
            "test_thumb_in_{}.pdf",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let temp_stripped = std::env::temp_dir().join(format!(
            "test_thumb_out_{}.pdf",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let _c1 = TempFileCleaner(temp_with_thumb.clone());
        let _c2 = TempFileCleaner(temp_stripped.clone());

        doc.save(&temp_with_thumb).unwrap();

        let options = PdfCompressionOptions {
            profile: PdfCompressionProfile::Balanced,
            optimize_structure: true,
            recompress_images: false,
            target_size_kb: None,
        };

        compress_pdf(&temp_with_thumb, &temp_stripped, &options).unwrap();

        let reloaded = Document::load(&temp_stripped).unwrap();
        let reloaded_page = reloaded.get_pages().into_values().next().unwrap();
        let page_dict = reloaded
            .get_object(reloaded_page)
            .unwrap()
            .as_dict()
            .unwrap();
        assert!(
            page_dict.get(b"Thumb").is_err(),
            "Thumb key should be removed from Page dictionary"
        );
        assert!(
            reloaded.objects.get(&thumb_id).is_none(),
            "Thumb stream object should be pruned"
        );
    }

    #[test]
    fn test_smask_dimensions_preserved() {
        let img = image::RgbImage::from_fn(400, 400, |x, y| {
            image::Rgb([(x % 256) as u8, (y % 256) as u8, 200])
        });
        let mut jpeg_data = Vec::new();
        image::codecs::jpeg::JpegEncoder::new_with_quality(&mut jpeg_data, 95)
            .encode_image(&img)
            .unwrap();

        let mut doc = Document::with_version("1.5");
        let pages_id = doc.new_object_id();
        let page_id = doc.new_object_id();
        let image_id = doc.new_object_id();
        let smask_id = doc.new_object_id();

        // Create fake SMask
        let mut smask_dict = lopdf::Dictionary::new();
        smask_dict.set("Type", Object::Name(b"XObject".to_vec()));
        smask_dict.set("Subtype", Object::Name(b"Image".to_vec()));
        smask_dict.set("Width", Object::Integer(400));
        smask_dict.set("Height", Object::Integer(400));
        smask_dict.set("ColorSpace", Object::Name(b"DeviceGray".to_vec()));
        let smask_stream = lopdf::Stream::new(smask_dict, vec![255; 400 * 400]);
        doc.objects.insert(smask_id, Object::Stream(smask_stream));

        let mut image_dict = lopdf::Dictionary::new();
        image_dict.set("Type", Object::Name(b"XObject".to_vec()));
        image_dict.set("Subtype", Object::Name(b"Image".to_vec()));
        image_dict.set("Width", Object::Integer(400));
        image_dict.set("Height", Object::Integer(400));
        image_dict.set("ColorSpace", Object::Name(b"DeviceRGB".to_vec()));
        image_dict.set("Filter", Object::Name(b"DCTDecode".to_vec()));
        image_dict.set("SMask", Object::Reference(smask_id));
        let image_stream = lopdf::Stream::new(image_dict, jpeg_data);
        doc.objects.insert(image_id, Object::Stream(image_stream));

        let mut xobjects = lopdf::Dictionary::new();
        xobjects.set("ImSmask", Object::Reference(image_id));
        let mut resources = lopdf::Dictionary::new();
        resources.set("XObject", Object::Dictionary(xobjects));

        let mut page_dict = lopdf::Dictionary::new();
        page_dict.set("Type", Object::Name(b"Page".to_vec()));
        page_dict.set("Parent", Object::Reference(pages_id));
        page_dict.set("Resources", Object::Dictionary(resources));
        page_dict.set(
            "MediaBox",
            Object::Array(vec![
                Object::Integer(0),
                Object::Integer(0),
                Object::Integer(600),
                Object::Integer(800),
            ]),
        );
        doc.objects.insert(page_id, Object::Dictionary(page_dict));

        let mut pages_dict = lopdf::Dictionary::new();
        pages_dict.set("Type", Object::Name(b"Pages".to_vec()));
        pages_dict.set("Kids", Object::Array(vec![Object::Reference(page_id)]));
        pages_dict.set("Count", Object::Integer(1));
        doc.objects.insert(pages_id, Object::Dictionary(pages_dict));

        let mut catalog = lopdf::Dictionary::new();
        catalog.set("Type", Object::Name(b"Catalog".to_vec()));
        catalog.set("Pages", Object::Reference(pages_id));
        let catalog_id = doc.add_object(Object::Dictionary(catalog));
        doc.trailer.set("Root", Object::Reference(catalog_id));

        // target_max_dim = 200, smaller than 400x400
        let (out_bytes, opt_count) = compress_doc_internal(doc, 50, 200, true, true, true).unwrap();
        assert!(opt_count >= 1);

        let reloaded = Document::load_mem(&out_bytes).unwrap();
        let img_stream = reloaded
            .objects
            .get(&image_id)
            .unwrap()
            .as_stream()
            .unwrap();
        let w = img_stream.dict.get(b"Width").unwrap().as_i64().unwrap();
        let h = img_stream.dict.get(b"Height").unwrap().as_i64().unwrap();
        // Dimensions must be preserved at 400x400 to maintain SMask alignment!
        assert_eq!(w, 400);
        assert_eq!(h, 400);
    }

    #[test]
    fn test_pdf_target_size_mode_fast() {
        let (temp_path, _cleaner) = create_temp_sample_pdf();
        let original_size = std::fs::metadata(&temp_path).unwrap().len();

        let temp_out = std::env::temp_dir().join(format!(
            "test_target_size_out_{}.pdf",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let _c = TempFileCleaner(temp_out.clone());

        // Target size smaller than original
        let target_kb = (original_size / 2 / 1024).max(1) as u32;
        let options = PdfCompressionOptions {
            profile: PdfCompressionProfile::Balanced,
            optimize_structure: true,
            recompress_images: true,
            target_size_kb: Some(target_kb),
        };

        let result = compress_pdf(&temp_path, &temp_out, &options).unwrap();
        assert!(result.compressed_bytes > 0);
        assert!(std::fs::metadata(&temp_out).unwrap().len() > 0);
    }
}
