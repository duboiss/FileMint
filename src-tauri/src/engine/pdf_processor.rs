use anyhow::{anyhow, Result};
use lopdf::{Document, Object};
use serde::{Deserialize, Serialize};
use std::fs::File;
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
}

impl Default for PdfCompressionOptions {
    fn default() -> Self {
        Self {
            profile: PdfCompressionProfile::Balanced,
            optimize_structure: true,
            recompress_images: true,
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

pub fn compress_pdf(
    input_path: &Path,
    output_path: &Path,
    options: &PdfCompressionOptions,
) -> Result<PdfResultInfo> {
    let original_bytes = std::fs::metadata(input_path)?.len();
    let mut doc = Document::load(input_path)
        .map_err(|e| anyhow!("Impossible de lire le document PDF : {}", e))?;

    if doc.is_encrypted() {
        return Err(anyhow!("Le document PDF est protégé par mot de passe."));
    }

    let pages_count = doc.get_pages().len() as u32;
    let mut image_count_optimized = 0;

    // Target quality and dimension constraints by profile
    let (target_jpeg_quality, target_max_dim) = match options.profile {
        PdfCompressionProfile::Readable => (85u8, 2400u32),
        PdfCompressionProfile::Balanced => (70u8, 1600u32),
        PdfCompressionProfile::Compact => (50u8, 1000u32),
    };

    // Recompress embedded XObject images when smaller
    if options.recompress_images {
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

    // Structural optimization: prune unreferenced objects and compress streams
    if options.optimize_structure {
        doc.prune_objects();
        doc.compress();
    }

    let mut file = File::create(output_path)?;
    doc.save_to(&mut file)?;

    let compressed_bytes = std::fs::metadata(output_path)?.len();
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
