use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::SystemTime;
use tauri::{AppHandle, Emitter};

use crate::engine::image_processor::{self, ImageTransformOptions};
use crate::engine::pdf_processor::{self, PdfCompressionOptions};

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct WatchFolderConfig {
    pub enabled: bool,
    pub watch_path: String,
    pub output_path: Option<String>,
    #[serde(default)]
    pub delete_source: bool,
    #[serde(default)]
    pub image_options: Option<ImageTransformOptions>,
    #[serde(default)]
    pub pdf_options: Option<PdfCompressionOptions>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WatchProcessedEvent {
    pub file_name: String,
    pub input_path: String,
    pub output_path: String,
    pub original_bytes: u64,
    pub final_bytes: u64,
    pub saved_bytes: i64,
    pub success: bool,
    pub error: Option<String>,
}

pub struct WatchFolderManager {
    config: Mutex<WatchFolderConfig>,
    stop_flag: Mutex<Option<Arc<AtomicBool>>>,
}

impl Default for WatchFolderManager {
    fn default() -> Self {
        Self::new()
    }
}

impl WatchFolderManager {
    pub fn new() -> Self {
        Self {
            config: Mutex::new(WatchFolderConfig::default()),
            stop_flag: Mutex::new(None),
        }
    }

    pub fn get_config(&self) -> WatchFolderConfig {
        self.config.lock().unwrap().clone()
    }

    pub fn update_config(&self, app: AppHandle, new_config: WatchFolderConfig) {
        // Stop any running loop
        {
            let mut flag_guard = self.stop_flag.lock().unwrap();
            if let Some(ref flag) = *flag_guard {
                flag.store(true, Ordering::SeqCst);
            }
            *flag_guard = None;
        }

        let mut cfg = self.config.lock().unwrap();
        *cfg = new_config.clone();

        if cfg.enabled && !cfg.watch_path.trim().is_empty() {
            let path = PathBuf::from(&cfg.watch_path);
            if path.is_dir() {
                let stop_flag = Arc::new(AtomicBool::new(false));
                {
                    let mut flag_guard = self.stop_flag.lock().unwrap();
                    *flag_guard = Some(stop_flag.clone());
                }
                let config_clone = new_config;

                tauri::async_runtime::spawn(async move {
                    run_watch_loop(app, config_clone, stop_flag).await;
                });
            }
        }
    }
}

fn process_watched_file(path: &Path, config: &WatchFolderConfig) -> Result<(PathBuf, u64, u64)> {
    let orig_len = std::fs::metadata(path)?.len();
    if orig_len == 0 {
        return Err(anyhow!("Fichier vide"));
    }

    let file_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| anyhow!("Nom de fichier invalide"))?;

    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    // Resolve destination folder
    let dest_dir = if let Some(ref custom_dest) = config.output_path {
        if !custom_dest.trim().is_empty() {
            PathBuf::from(custom_dest)
        } else {
            PathBuf::from(&config.watch_path).join("FileMint_Optimized")
        }
    } else {
        PathBuf::from(&config.watch_path).join("FileMint_Optimized")
    };

    if !dest_dir.exists() {
        std::fs::create_dir_all(&dest_dir)?;
    }

    let stem = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("document");

    if ext == "pdf" {
        let pdf_opts = config.pdf_options.clone().unwrap_or_default();
        let out_file = dest_dir.join(file_name);
        let res = pdf_processor::compress_pdf(path, &out_file, &pdf_opts)?;
        Ok((out_file, res.original_bytes, res.compressed_bytes))
    } else {
        let img_opts = config.image_options.clone().unwrap_or_default();
        let (img, orig_format) = image_processor::load_dynamic_image(path)?;
        let (bytes, target_format, _, _, _) =
            image_processor::process_image_to_memory(&img, orig_format, &img_opts)?;

        let target_ext = match target_format {
            image::ImageFormat::Jpeg => "jpg",
            image::ImageFormat::Png => "png",
            image::ImageFormat::WebP => "webp",
            image::ImageFormat::Avif => "avif",
            _ => "jpg",
        };

        let out_file = dest_dir.join(format!("{}.{}", stem, target_ext));
        std::fs::write(&out_file, &bytes)?;
        let final_len = bytes.len() as u64;
        Ok((out_file, orig_len, final_len))
    }
}

async fn run_watch_loop(app: AppHandle, config: WatchFolderConfig, stop_flag: Arc<AtomicBool>) {
    let watch_dir = PathBuf::from(&config.watch_path);
    let mut processed_signatures: HashSet<(PathBuf, u64, Option<SystemTime>)> = HashSet::new();

    // Populate initial existing files so they are not re-processed immediately unless delete_source is set
    if !config.delete_source {
        if let Ok(entries) = std::fs::read_dir(&watch_dir) {
            for entry in entries.flatten() {
                if let Ok(meta) = entry.metadata() {
                    if meta.is_file() {
                        processed_signatures.insert((
                            entry.path(),
                            meta.len(),
                            meta.modified().ok(),
                        ));
                    }
                }
            }
        }
    }

    while !stop_flag.load(Ordering::Relaxed) {
        tokio::time::sleep(tokio::time::Duration::from_millis(1500)).await;

        if stop_flag.load(Ordering::Relaxed) {
            break;
        }

        if !watch_dir.is_dir() {
            continue;
        }

        let entries = match std::fs::read_dir(&watch_dir) {
            Ok(e) => e,
            Err(_) => continue,
        };

        for entry in entries.flatten() {
            if stop_flag.load(Ordering::Relaxed) {
                break;
            }

            let path = entry.path();
            let meta = match entry.metadata() {
                Ok(m) => m,
                Err(_) => continue,
            };

            if !meta.is_file() {
                continue;
            }

            let file_name = match path.file_name().and_then(|n| n.to_str()) {
                Some(n) => n.to_string(),
                None => continue,
            };

            // Skip hidden or temp files
            if file_name.starts_with('.')
                || file_name.starts_with('~')
                || file_name.ends_with(".tmp")
                || file_name.ends_with(".crdownload")
                || file_name.ends_with(".part")
            {
                continue;
            }

            let ext = path
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("")
                .to_lowercase();
            let is_supported = matches!(
                ext.as_str(),
                "jpg"
                    | "jpeg"
                    | "png"
                    | "webp"
                    | "avif"
                    | "heic"
                    | "heif"
                    | "bmp"
                    | "gif"
                    | "tiff"
                    | "pdf"
            );
            if !is_supported {
                continue;
            }

            let file_size = meta.len();
            if file_size == 0 {
                continue;
            }

            let mtime = meta.modified().ok();
            let sig = (path.clone(), file_size, mtime);

            if processed_signatures.contains(&sig) {
                continue;
            }

            // Stability check: ensure file is not currently being written
            tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
            let current_meta = match std::fs::metadata(&path) {
                Ok(m) => m,
                Err(_) => continue,
            };
            if current_meta.len() != file_size {
                continue;
            }

            let result = process_watched_file(&path, &config);
            match result {
                Ok((out_path, orig_len, final_len)) => {
                    let saved = (orig_len as i64) - (final_len as i64);
                    let event = WatchProcessedEvent {
                        file_name: file_name.clone(),
                        input_path: path.to_string_lossy().to_string(),
                        output_path: out_path.to_string_lossy().to_string(),
                        original_bytes: orig_len,
                        final_bytes: final_len,
                        saved_bytes: saved,
                        success: true,
                        error: None,
                    };
                    let _ = app.emit("filemint://watch-file-processed", &event);

                    if config.delete_source {
                        let _ = std::fs::remove_file(&path);
                    } else {
                        processed_signatures.insert(sig);
                    }
                }
                Err(err) => {
                    let event = WatchProcessedEvent {
                        file_name: file_name.clone(),
                        input_path: path.to_string_lossy().to_string(),
                        output_path: String::new(),
                        original_bytes: file_size,
                        final_bytes: file_size,
                        saved_bytes: 0,
                        success: false,
                        error: Some(err.to_string()),
                    };
                    let _ = app.emit("filemint://watch-file-processed", &event);
                    processed_signatures.insert(sig);
                }
            }
        }
    }
}
