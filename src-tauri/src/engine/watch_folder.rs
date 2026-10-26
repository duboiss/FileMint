use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::collections::{HashSet, VecDeque};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::SystemTime;
use tauri::{AppHandle, Emitter};

use crate::engine::file_manager::validate_and_sanitize_destination_dir;
use crate::engine::image_processor::{self, ImageTransformOptions};
use crate::engine::pdf_processor::{self, PdfCompressionOptions};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WatchFolderRule {
    pub id: String,
    #[serde(default)]
    pub name: Option<String>,
    pub enabled: bool,
    pub watch_path: String,
    pub output_path: Option<String>,
    #[serde(default)]
    pub delete_source: bool,
    #[serde(default)]
    pub profile_id: Option<String>,
    #[serde(default)]
    pub image_options: Option<ImageTransformOptions>,
    #[serde(default)]
    pub pdf_options: Option<PdfCompressionOptions>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct WatchFolderConfig {
    #[serde(default)]
    pub rules: Vec<WatchFolderRule>,
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub watch_path: String,
    pub output_path: Option<String>,
    #[serde(default)]
    pub delete_source: bool,
    #[serde(default)]
    pub profile_id: Option<String>,
    #[serde(default)]
    pub image_options: Option<ImageTransformOptions>,
    #[serde(default)]
    pub pdf_options: Option<PdfCompressionOptions>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WatchProcessedEvent {
    #[serde(default)]
    pub rule_id: Option<String>,
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
    rules: Mutex<Vec<WatchFolderRule>>,
    stop_flags: Mutex<Vec<Arc<AtomicBool>>>,
}

impl Default for WatchFolderManager {
    fn default() -> Self {
        Self::new()
    }
}

impl WatchFolderManager {
    pub fn new() -> Self {
        Self {
            rules: Mutex::new(Vec::new()),
            stop_flags: Mutex::new(Vec::new()),
        }
    }

    pub fn get_rules(&self) -> Vec<WatchFolderRule> {
        self.rules.lock().unwrap().clone()
    }

    pub fn get_legacy_config(&self) -> WatchFolderConfig {
        let rules = self.rules.lock().unwrap().clone();
        if let Some(first) = rules.first() {
            WatchFolderConfig {
                rules: rules.clone(),
                enabled: first.enabled,
                watch_path: first.watch_path.clone(),
                output_path: first.output_path.clone(),
                delete_source: first.delete_source,
                profile_id: first.profile_id.clone(),
                image_options: first.image_options.clone(),
                pdf_options: first.pdf_options.clone(),
            }
        } else {
            WatchFolderConfig {
                rules,
                ..Default::default()
            }
        }
    }

    pub fn update_rules(&self, app: AppHandle, new_rules: Vec<WatchFolderRule>) {
        // Stop any running loops
        {
            let mut flag_guard = self.stop_flags.lock().unwrap();
            for flag in flag_guard.iter() {
                flag.store(true, Ordering::SeqCst);
            }
            flag_guard.clear();
        }

        let mut stored_rules = self.rules.lock().unwrap();
        *stored_rules = new_rules.clone();

        let mut new_flags = Vec::new();
        let mut seen_paths = HashSet::new();

        for rule in new_rules.into_iter() {
            if !rule.enabled || rule.watch_path.trim().is_empty() {
                continue;
            }

            let watch_path = PathBuf::from(&rule.watch_path);
            if !watch_path.is_dir() {
                continue;
            }

            let canonical = watch_path
                .canonicalize()
                .unwrap_or_else(|_| watch_path.clone());
            if !seen_paths.insert(canonical) {
                continue;
            }

            let stop_flag = Arc::new(AtomicBool::new(false));
            new_flags.push(stop_flag.clone());

            let app_clone = app.clone();
            tauri::async_runtime::spawn(async move {
                run_watch_loop(app_clone, rule, stop_flag).await;
            });
        }

        let mut flag_guard = self.stop_flags.lock().unwrap();
        *flag_guard = new_flags;
    }

    pub fn update_legacy_config(&self, app: AppHandle, config: WatchFolderConfig) {
        if !config.rules.is_empty() {
            self.update_rules(app, config.rules);
        } else if !config.watch_path.trim().is_empty() {
            let rule = WatchFolderRule {
                id: "default".to_string(),
                name: Some("Dossier principal".to_string()),
                enabled: config.enabled,
                watch_path: config.watch_path,
                output_path: config.output_path,
                delete_source: config.delete_source,
                profile_id: config.profile_id,
                image_options: config.image_options,
                pdf_options: config.pdf_options,
            };
            self.update_rules(app, vec![rule]);
        } else {
            self.update_rules(app, Vec::new());
        }
    }
}

fn process_watched_file(path: &Path, rule: &WatchFolderRule) -> Result<(PathBuf, u64, u64)> {
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
    let dest_dir = if let Some(ref custom_dest) = rule.output_path {
        let trimmed = custom_dest.trim();
        if !trimmed.is_empty() {
            validate_and_sanitize_destination_dir(trimmed)?
        } else {
            PathBuf::from(&rule.watch_path).join("FileMint_Optimized")
        }
    } else {
        PathBuf::from(&rule.watch_path).join("FileMint_Optimized")
    };

    if !dest_dir.exists() {
        std::fs::create_dir_all(&dest_dir)?;
    }

    let stem = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("document");

    if ext == "pdf" {
        let pdf_opts = rule.pdf_options.clone().unwrap_or_default();
        let mut out_file = dest_dir.join(file_name);
        // [CORR-07] Prevent overwriting source or existing output files silently
        if out_file == *path || out_file.exists() {
            let mut counter = 1;
            while out_file.exists() {
                out_file = dest_dir.join(format!("{}_{}.pdf", stem, counter));
                counter += 1;
            }
        }
        let res = pdf_processor::compress_pdf(path, &out_file, &pdf_opts)?;
        Ok((out_file, res.original_bytes, res.compressed_bytes))
    } else {
        let img_opts = rule.image_options.clone().unwrap_or_default();
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

        let mut out_file = dest_dir.join(format!("{}.{}", stem, target_ext));
        // [CORR-07] Prevent self-overwriting source file and avoid silent overwrite if destination file already exists
        if out_file == *path || out_file.exists() {
            let mut counter = 1;
            while out_file.exists() {
                out_file = dest_dir.join(format!("{}_{}.{}", stem, counter, target_ext));
                counter += 1;
            }
        }
        std::fs::write(&out_file, &bytes)?;
        let final_len = bytes.len() as u64;
        Ok((out_file, orig_len, final_len))
    }
}

async fn run_watch_loop(app: AppHandle, rule: WatchFolderRule, stop_flag: Arc<AtomicBool>) {
    let watch_dir = PathBuf::from(&rule.watch_path);
    let mut processed_signatures: HashSet<(PathBuf, u64, Option<SystemTime>)> = HashSet::new();
    let mut signature_order: VecDeque<(PathBuf, u64, Option<SystemTime>)> = VecDeque::new();

    let record_sig = |set: &mut HashSet<(PathBuf, u64, Option<SystemTime>)>,
                      order: &mut VecDeque<(PathBuf, u64, Option<SystemTime>)>,
                      sig: (PathBuf, u64, Option<SystemTime>)| {
        if set.insert(sig.clone()) {
            order.push_back(sig);
            if order.len() > 2000 {
                if let Some(oldest) = order.pop_front() {
                    set.remove(&oldest);
                }
            }
        }
    };

    // Populate initial existing files so they are not re-processed immediately unless delete_source is set
    if !rule.delete_source {
        if let Ok(entries) = std::fs::read_dir(&watch_dir) {
            for entry in entries.flatten() {
                if let Ok(meta) = entry.metadata() {
                    if meta.is_file() {
                        record_sig(
                            &mut processed_signatures,
                            &mut signature_order,
                            (entry.path(), meta.len(), meta.modified().ok()),
                        );
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

            // [PERF-07] Run blocking image/PDF processing on a blocking thread
            let path_clone = path.clone();
            let rule_clone = rule.clone();
            let result =
                tokio::task::spawn_blocking(move || process_watched_file(&path_clone, &rule_clone))
                    .await
                    .unwrap_or_else(|e| Err(anyhow!("Task failed: {}", e)));
            match result {
                Ok((out_path, orig_len, final_len)) => {
                    let saved = (orig_len as i64) - (final_len as i64);
                    let event = WatchProcessedEvent {
                        rule_id: Some(rule.id.clone()),
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

                    if let Ok(meta_out) = std::fs::metadata(&out_path) {
                        record_sig(
                            &mut processed_signatures,
                            &mut signature_order,
                            (out_path.clone(), meta_out.len(), meta_out.modified().ok()),
                        );
                    }

                    if rule.delete_source {
                        let _ = std::fs::remove_file(&path);
                    } else {
                        record_sig(&mut processed_signatures, &mut signature_order, sig);
                    }
                }
                Err(err) => {
                    let event = WatchProcessedEvent {
                        rule_id: Some(rule.id.clone()),
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
                    record_sig(&mut processed_signatures, &mut signature_order, sig);
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_watch_folder_rule_serialization() {
        let rule = WatchFolderRule {
            id: "rule_1".to_string(),
            name: Some("Photos Dropbox".to_string()),
            enabled: true,
            watch_path: "C:\\Drop".to_string(),
            output_path: Some("C:\\Out".to_string()),
            delete_source: true,
            profile_id: Some("preset_web".to_string()),
            image_options: None,
            pdf_options: None,
        };

        let json = serde_json::to_string(&rule).expect("Serialize error");
        let deserialized: WatchFolderRule = serde_json::from_str(&json).expect("Deserialize error");
        assert_eq!(deserialized.id, "rule_1");
        assert_eq!(deserialized.name, Some("Photos Dropbox".to_string()));
        assert!(deserialized.enabled);
        assert!(deserialized.delete_source);
        assert_eq!(deserialized.output_path, Some("C:\\Out".to_string()));
    }

    #[test]
    fn test_legacy_watch_folder_config_compatibility() {
        let manager = WatchFolderManager::new();
        assert!(manager.get_rules().is_empty());

        let legacy = WatchFolderConfig {
            rules: vec![],
            enabled: true,
            watch_path: "C:\\LegacyWatch".to_string(),
            output_path: None,
            delete_source: false,
            profile_id: None,
            image_options: None,
            pdf_options: None,
        };

        let json = serde_json::to_string(&legacy).expect("Serialize error");
        let parsed: WatchFolderConfig = serde_json::from_str(&json).expect("Deserialize error");
        assert!(parsed.enabled);
        assert_eq!(parsed.watch_path, "C:\\LegacyWatch");
    }
}
