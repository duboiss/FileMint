use anyhow::Result;
use image::GenericImageView;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};

use super::file_manager::{self, DestinationConfig};
use super::image_processor::{self, ImageTransformOptions, OutputFormat};
use super::metadata_manager;
use super::pdf_processor::{self, PdfCompressionOptions};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ItemAction {
    Image(ImageTransformOptions),
    Pdf(PdfCompressionOptions),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchItemConfig {
    pub input_path: String,
    pub action: ItemAction,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchRequest {
    pub items: Vec<BatchItemConfig>,
    pub destination: DestinationConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgressEventPayload {
    pub current_index: usize,
    pub total_items: usize,
    pub current_file: String,
    pub success: bool,
    pub error_message: Option<String>,
    pub saved_bytes: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ItemSummary {
    pub file_name: String,
    pub original_size: u64,
    pub final_size: u64,
    pub success: bool,
    pub error: Option<String>,
    pub output_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchSummary {
    pub total_items: usize,
    pub success_count: usize,
    pub failure_count: usize,
    pub total_original_bytes: u64,
    pub total_final_bytes: u64,
    pub total_saved_bytes: i64,
    pub items: Vec<ItemSummary>,
    pub cancelled: bool,
}

pub struct BatchRunner {
    pub cancel_flag: Arc<AtomicBool>,
}

impl Default for BatchRunner {
    fn default() -> Self {
        Self::new()
    }
}

impl BatchRunner {
    pub fn new() -> Self {
        Self {
            cancel_flag: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn with_cancel_flag(cancel_flag: Arc<AtomicBool>) -> Self {
        Self { cancel_flag }
    }

    pub fn cancel(&self) {
        self.cancel_flag.store(true, Ordering::SeqCst);
    }

    pub fn run(&self, app: AppHandle, request: BatchRequest) -> Result<BatchSummary> {
        self.cancel_flag.store(false, Ordering::SeqCst);
        let total_items = request.items.len();
        let mut summaries = Vec::with_capacity(total_items);

        let mut total_original_bytes: u64 = 0;
        let mut total_final_bytes: u64 = 0;
        let mut success_count = 0;
        let mut failure_count = 0;

        for (idx, item) in request.items.iter().enumerate() {
            // Check cancellation flag
            if self.cancel_flag.load(Ordering::Relaxed) {
                break;
            }

            let input_path = PathBuf::from(&item.input_path);
            let file_name = input_path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("fichier")
                .to_string();

            let orig_len = std::fs::metadata(&input_path).map(|m| m.len()).unwrap_or(0);
            total_original_bytes += orig_len;

            let result =
                self.process_single_item(&input_path, &item.action, &request.destination, idx + 1);

            let (success, err_msg, final_len, out_path_str) = match result {
                Ok((path, final_size)) => {
                    success_count += 1;
                    total_final_bytes += final_size;
                    (
                        true,
                        None,
                        final_size,
                        Some(path.to_string_lossy().to_string()),
                    )
                }
                Err(e) => {
                    failure_count += 1;
                    total_final_bytes += orig_len;
                    (false, Some(e.to_string()), orig_len, None)
                }
            };

            let item_saved = (orig_len as i64) - (final_len as i64);

            summaries.push(ItemSummary {
                file_name: file_name.clone(),
                original_size: orig_len,
                final_size: final_len,
                success,
                error: err_msg.clone(),
                output_path: out_path_str,
            });

            // Emit progress event to frontend
            let _ = app.emit(
                "filemint://batch-progress",
                ProgressEventPayload {
                    current_index: idx + 1,
                    total_items,
                    current_file: file_name,
                    success,
                    error_message: err_msg,
                    saved_bytes: item_saved,
                },
            );
        }

        let is_cancelled = self.cancel_flag.load(Ordering::SeqCst);
        let total_saved_bytes = (total_original_bytes as i64) - (total_final_bytes as i64);

        let summary = BatchSummary {
            total_items,
            success_count,
            failure_count,
            total_original_bytes,
            total_final_bytes,
            total_saved_bytes,
            items: summaries,
            cancelled: is_cancelled,
        };

        let _ = app.emit("filemint://batch-finished", &summary);

        Ok(summary)
    }

    fn process_single_item(
        &self,
        input_path: &Path,
        action: &ItemAction,
        dest_config: &DestinationConfig,
        item_index: usize,
    ) -> Result<(PathBuf, u64)> {
        match action {
            ItemAction::Image(options) => {
                let target_ext = match options.format {
                    OutputFormat::Jpeg => Some("jpg"),
                    OutputFormat::Png => Some("png"),
                    OutputFormat::Webp => Some("webp"),
                    OutputFormat::Avif => Some("avif"),
                    OutputFormat::Original => {
                        let ext = input_path
                            .extension()
                            .and_then(|e| e.to_str())
                            .unwrap_or("")
                            .to_lowercase();
                        if ext == "heic" || ext == "heif" {
                            Some("jpg")
                        } else {
                            None
                        }
                    }
                };

                let is_format_same = match options.format {
                    OutputFormat::Original => {
                        let ext = input_path
                            .extension()
                            .and_then(|e| e.to_str())
                            .unwrap_or("")
                            .to_lowercase();
                        ext != "heic" && ext != "heif"
                    }
                    _ => false,
                };

                let has_pixel_transformations = options.rotation != 0
                    || options.flip_horizontal
                    || options.flip_vertical
                    || options.grayscale
                    || options.color_filter != image_processor::ColorFilter::None
                    || !matches!(options.resize_mode, image_processor::ResizeMode::None);

                // Fast path: when compression is disabled and no pixel transforms or format conversions are needed,
                // keep original bytes intact (bit-exact) with zero re-encoding artifacts.
                if !options.compress && is_format_same && !has_pixel_transformations {
                    let mut raw_bytes = std::fs::read(input_path)?;
                    let (orig_w, orig_h) = image::ImageReader::open(input_path)
                        .ok()
                        .and_then(|r| r.into_dimensions().ok())
                        .or_else(|| {
                            image_processor::load_dynamic_image(input_path)
                                .ok()
                                .map(|(img, _)| img.dimensions())
                        })
                        .unwrap_or((0, 0));

                    let naming_ctx = file_manager::NamingContext {
                        width: Some(orig_w),
                        height: Some(orig_h),
                        quality: Some(100),
                        index: item_index,
                        pdf_profile: None,
                    };

                    let final_path = file_manager::resolve_output_path(
                        input_path,
                        target_ext,
                        dest_config,
                        Some(&naming_ctx),
                    )?;
                    let (temp_path, guard) = file_manager::create_temp_target(&final_path)?;

                    let out_ext = final_path
                        .extension()
                        .and_then(|e| e.to_str())
                        .unwrap_or("");
                    let _ = metadata_manager::apply_metadata_policy(
                        input_path,
                        &mut raw_bytes,
                        out_ext,
                        options.metadata_policy,
                    );

                    std::fs::write(&temp_path, &raw_bytes)?;
                    let final_size = raw_bytes.len() as u64;

                    file_manager::commit_temp_file(&temp_path, &final_path, guard)?;
                    return Ok((final_path, final_size));
                }

                let (img, orig_format) = image_processor::load_dynamic_image(input_path)?;

                let (encoded_bytes, _, new_w, new_h, _) =
                    image_processor::process_image_to_memory(&img, orig_format, options)?;

                let naming_ctx = file_manager::NamingContext {
                    width: Some(new_w),
                    height: Some(new_h),
                    quality: Some(if options.compress {
                        options.quality
                    } else {
                        100
                    }),
                    index: item_index,
                    pdf_profile: None,
                };

                let final_path = file_manager::resolve_output_path(
                    input_path,
                    target_ext,
                    dest_config,
                    Some(&naming_ctx),
                )?;
                let (temp_path, guard) = file_manager::create_temp_target(&final_path)?;

                let mut final_bytes = encoded_bytes;
                let out_ext = final_path
                    .extension()
                    .and_then(|e| e.to_str())
                    .unwrap_or("");
                let _ = metadata_manager::apply_metadata_policy(
                    input_path,
                    &mut final_bytes,
                    out_ext,
                    options.metadata_policy,
                );

                std::fs::write(&temp_path, &final_bytes)?;
                let final_size = final_bytes.len() as u64;

                file_manager::commit_temp_file(&temp_path, &final_path, guard)?;
                Ok((final_path, final_size))
            }
            ItemAction::Pdf(options) => {
                let profile_str = match options.profile {
                    pdf_processor::PdfCompressionProfile::Readable => "readable",
                    pdf_processor::PdfCompressionProfile::Balanced => "balanced",
                    pdf_processor::PdfCompressionProfile::Compact => "compact",
                };
                let naming_ctx = file_manager::NamingContext {
                    width: None,
                    height: None,
                    quality: None,
                    index: item_index,
                    pdf_profile: Some(profile_str.to_string()),
                };
                let final_path = file_manager::resolve_output_path(
                    input_path,
                    Some("pdf"),
                    dest_config,
                    Some(&naming_ctx),
                )?;
                let (temp_path, guard) = file_manager::create_temp_target(&final_path)?;

                let pdf_info = pdf_processor::compress_pdf(input_path, &temp_path, options)?;
                file_manager::commit_temp_file(&temp_path, &final_path, guard)?;

                Ok((final_path, pdf_info.compressed_bytes))
            }
        }
    }
}
