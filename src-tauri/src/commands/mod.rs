use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, State};

use crate::engine::batch_runner::{BatchRequest, BatchRunner, BatchSummary};
use crate::engine::file_manager;
use crate::engine::image_processor::{self, ImageTransformOptions, PreviewResult};
use crate::engine::update_checker::{self, UpdateInfo};
use crate::engine::watch_folder::{WatchFolderConfig, WatchFolderManager};
use crate::shell::windows_registry;

pub struct AppState {
    pub runner: Mutex<BatchRunner>,
    pub cli_files: Mutex<Vec<String>>,
    pub watch_manager: WatchFolderManager,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileMetadataResponse {
    pub path: String,
    pub name: String,
    pub size_bytes: u64,
    pub file_type: String, // "image", "pdf", or "unknown"
    pub format: String,
    pub width: Option<u32>,
    pub height: Option<u32>,
    #[serde(default)]
    pub has_gps: Option<bool>,
    #[serde(default)]
    pub has_exif: Option<bool>,
}

#[tauri::command]
pub fn get_files_metadata(paths: Vec<String>) -> Vec<FileMetadataResponse> {
    paths
        .into_iter()
        .filter_map(|p_str| {
            let path = PathBuf::from(&p_str);
            if !path.exists() {
                return None;
            }

            let name = path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("unknown")
                .to_string();

            let size_bytes = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
            let ext = path
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("")
                .to_lowercase();

            if ext == "pdf" {
                Some(FileMetadataResponse {
                    path: p_str,
                    name,
                    size_bytes,
                    file_type: "pdf".to_string(),
                    format: "PDF".to_string(),
                    width: None,
                    height: None,
                    has_gps: None,
                    has_exif: None,
                })
            } else if matches!(
                ext.as_str(),
                "jpg" | "jpeg" | "png" | "webp" | "bmp" | "gif" | "tiff" | "avif" | "heic" | "heif"
            ) {
                let img_meta = image_processor::get_metadata(&path).ok();
                Some(FileMetadataResponse {
                    path: p_str,
                    name,
                    size_bytes,
                    file_type: "image".to_string(),
                    format: img_meta
                        .as_ref()
                        .map(|m| m.format.clone())
                        .unwrap_or_else(|| ext.to_uppercase()),
                    width: img_meta.as_ref().map(|m| m.width),
                    height: img_meta.as_ref().map(|m| m.height),
                    has_gps: img_meta.as_ref().map(|m| m.has_gps),
                    has_exif: img_meta.as_ref().map(|m| m.has_exif),
                })
            } else {
                None
            }
        })
        .collect()
}

#[tauri::command]
pub async fn generate_image_preview(
    path: String,
    options: ImageTransformOptions,
) -> Result<PreviewResult, String> {
    tokio::task::spawn_blocking(move || {
        let p = Path::new(&path);
        image_processor::generate_preview(p, &options).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn start_batch_processing(
    app: AppHandle,
    state: State<'_, AppState>,
    request: BatchRequest,
) -> Result<BatchSummary, String> {
    let runner = state.runner.lock().map_err(|_| "State lock unavailable")?;
    runner.run(app, request).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn cancel_batch_processing(state: State<'_, AppState>) -> Result<(), String> {
    let runner = state.runner.lock().map_err(|_| "State lock unavailable")?;
    runner.cancel();
    Ok(())
}

#[tauri::command]
pub fn open_path_in_explorer(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    file_manager::open_directory_in_explorer(p).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn check_update(current_version: String) -> Option<UpdateInfo> {
    update_checker::check_for_updates(&current_version).await
}

#[tauri::command]
pub async fn download_and_install_update(
    app: AppHandle,
    download_url: String,
    asset_name: String,
) -> Result<(), String> {
    update_checker::download_and_install(&app, &download_url, &asset_name).await
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextMenuStatus {
    pub enabled: bool,
    pub mode: String,
}

#[tauri::command]
pub async fn toggle_windows_context_menu(
    enable: bool,
    mode: Option<String>,
    lang: Option<String>,
) -> Result<ContextMenuStatus, String> {
    tokio::task::spawn_blocking(move || {
        let target_mode = mode.unwrap_or_else(|| "modern".to_string());
        if enable && target_mode != "disabled" {
            windows_registry::register_context_menu(&target_mode, lang.as_deref())
                .map_err(|e| e.to_string())?;
        } else {
            windows_registry::unregister_context_menu().map_err(|e| e.to_string())?;
        }
        Ok(ContextMenuStatus {
            enabled: windows_registry::is_context_menu_registered(),
            mode: windows_registry::get_context_menu_mode(),
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn get_windows_context_menu_status() -> ContextMenuStatus {
    ContextMenuStatus {
        enabled: windows_registry::is_context_menu_registered(),
        mode: windows_registry::get_context_menu_mode(),
    }
}

#[tauri::command]
pub fn get_cli_files(state: State<'_, AppState>) -> Vec<String> {
    let mut files = state.cli_files.lock().unwrap();
    std::mem::take(&mut *files)
}

#[tauri::command]
pub fn get_watch_folder_config(state: State<'_, AppState>) -> WatchFolderConfig {
    state.watch_manager.get_config()
}

#[tauri::command]
pub fn set_watch_folder_config(
    app: AppHandle,
    state: State<'_, AppState>,
    config: WatchFolderConfig,
) -> Result<(), String> {
    state.watch_manager.update_config(app, config);
    Ok(())
}
