use anyhow::{anyhow, Result};
use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use lopdf::{Document, Object};
use serde::{Deserialize, Serialize};
use std::io::Cursor;
use std::path::Path;

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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_page_one() {
        let path = r"C:\Users\Steven\.cargo\registry\src\index.crates.io-1949cf8c6b5b557f\lopdf-0.35.0\assets\example.pdf";
        let mut doc = Document::load(path).unwrap();
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
        let path = std::path::Path::new(r"C:\Users\Steven\.cargo\registry\src\index.crates.io-1949cf8c6b5b557f\lopdf-0.35.0\assets\example.pdf");
        let opts = PdfCompressionOptions::default();
        let preview = generate_pdf_preview(path, &opts).unwrap();
        assert_eq!(preview.total_pages, 1);
        assert!(!preview.original_page_pdf_base64.is_empty());
        assert!(!preview.compressed_page_pdf_base64.is_empty());
        assert!(preview.estimated_bytes > 0);
    }
}
