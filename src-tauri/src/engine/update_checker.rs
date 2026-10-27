use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::fs::File;
use tokio::io::AsyncWriteExt;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateInfo {
    pub has_update: bool,
    pub latest_version: String,
    pub release_notes_url: String,
    pub download_url: Option<String>,
    pub asset_name: Option<String>,
    pub asset_size: Option<u64>,
    pub is_downloaded: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingUpdate {
    pub version: String,
    pub installer_path: String,
}

#[derive(Deserialize)]
struct GitHubAsset {
    name: String,
    browser_download_url: String,
    size: u64,
}

#[derive(Deserialize)]
struct GitHubRelease {
    tag_name: String,
    html_url: String,
    #[serde(default)]
    assets: Vec<GitHubAsset>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateProgressPayload {
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub percent: u32,
}

pub fn get_update_dir() -> PathBuf {
    let dir = dirs::data_local_dir()
        .map(|d| d.join("FileMint").join("Updates"))
        .unwrap_or_else(|| std::env::temp_dir().join("FileMint-Updates"));
    std::fs::create_dir_all(&dir).ok();
    dir
}

pub fn get_pending_update_file() -> PathBuf {
    get_update_dir().join("pending_update.json")
}

pub fn read_pending_update() -> Option<PendingUpdate> {
    let path = get_pending_update_file();
    if path.exists() {
        if let Ok(content) = std::fs::read_to_string(&path) {
            if let Ok(pending) = serde_json::from_str::<PendingUpdate>(&content) {
                if Path::new(&pending.installer_path).exists() {
                    return Some(pending);
                }
            }
        }
    }
    None
}

pub fn save_pending_update(version: &str, installer_path: &Path) {
    let pending = PendingUpdate {
        version: version.to_string(),
        installer_path: installer_path.to_string_lossy().to_string(),
    };
    if let Ok(json) = serde_json::to_string(&pending) {
        let _ = std::fs::write(get_pending_update_file(), json);
    }
}

pub fn clear_pending_update() {
    let _ = std::fs::remove_file(get_pending_update_file());
}

pub fn is_update_downloaded(version: &str) -> bool {
    if let Some(pending) = read_pending_update() {
        if pending.version == version {
            return true;
        }
    }
    false
}

pub async fn check_for_updates(current_version: &str) -> Option<UpdateInfo> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(3))
        .user_agent("FileMint-Update-Check/1.0")
        .build()
        .ok()?;

    let response = client
        .get("https://api.github.com/repos/duboiss/FileMint/releases/latest")
        .send()
        .await
        .ok()?;

    if !response.status().is_success() {
        return None;
    }

    let release: GitHubRelease = response.json().await.ok()?;
    let latest_tag = release.tag_name.trim_start_matches('v');

    let has_update = is_newer_version(latest_tag, current_version);
    let is_downloaded = has_update && is_update_downloaded(latest_tag);

    let target_asset = release.assets.iter().find(|a| {
        #[cfg(target_os = "windows")]
        {
            a.name.ends_with("-setup.exe") || a.name.ends_with(".exe")
        }
        #[cfg(target_os = "macos")]
        {
            a.name.ends_with(".dmg") || a.name.ends_with(".tar.gz")
        }
        #[cfg(target_os = "linux")]
        {
            a.name.ends_with(".AppImage") || a.name.ends_with(".deb")
        }
        #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
        {
            false
        }
    });

    Some(UpdateInfo {
        has_update,
        latest_version: latest_tag.to_string(),
        release_notes_url: release.html_url,
        download_url: target_asset.map(|a| a.browser_download_url.clone()),
        asset_name: target_asset.map(|a| a.name.clone()),
        asset_size: target_asset.map(|a| a.size),
        is_downloaded,
    })
}

pub async fn download_update(
    app: &AppHandle,
    download_url: &str,
    asset_name: &str,
    version: &str,
) -> Result<(), String> {
    // [SEC-03] Validate download URL strictly
    if !download_url.starts_with("https://github.com/duboiss/FileMint/releases/") {
        return Err(
            "URL de téléchargement non autorisée (doit provenir des releases officielles FileMint)"
                .to_string(),
        );
    }

    // [SEC-01] Path traversal sanitization
    let file_name = Path::new(asset_name)
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| "Nom de fichier d'installation invalide".to_string())?;

    if file_name.contains('/') || file_name.contains('\\') || file_name.contains("..") {
        return Err("Nom de fichier d'installation suspect".to_string());
    }

    let client = reqwest::Client::builder()
        .user_agent("FileMint-Update-Downloader/1.0")
        .build()
        .map_err(|e| format!("Erreur client HTTP : {}", e))?;

    let mut response = client
        .get(download_url)
        .send()
        .await
        .map_err(|e| format!("Erreur lors de la requête de téléchargement : {}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "Échec du téléchargement, code HTTP : {}",
            response.status()
        ));
    }

    let total_bytes = response.content_length().unwrap_or(0);
    let mut downloaded_bytes: u64 = 0;

    let update_dir = get_update_dir();
    let installer_path = update_dir.join(file_name);

    if !installer_path.starts_with(&update_dir) {
        return Err("Chemin d'installation hors du dossier de mises à jour".to_string());
    }

    if installer_path.exists() {
        let _ = std::fs::remove_file(&installer_path);
    }

    {
        let mut file = File::create(&installer_path)
            .await
            .map_err(|e| format!("Impossible de créer le fichier d'installation : {}", e))?;

        while let Some(chunk) = response
            .chunk()
            .await
            .map_err(|e| format!("Erreur lors de la réception des données : {}", e))?
        {
            file.write_all(&chunk)
                .await
                .map_err(|e| format!("Erreur lors de l'écriture du fichier : {}", e))?;

            downloaded_bytes += chunk.len() as u64;

            let percent = if total_bytes > 0 {
                ((downloaded_bytes as f64 / total_bytes as f64) * 100.0).min(100.0) as u32
            } else {
                0
            };

            let _ = app.emit(
                "filemint://update-download-progress",
                UpdateProgressPayload {
                    downloaded_bytes,
                    total_bytes,
                    percent,
                },
            );
        }

        file.flush()
            .await
            .map_err(|e| format!("Erreur lors de la finalisation du fichier : {}", e))?;

        // CRITICAL: Drop file explicitly to release Windows write lock (avoids os error 32)
        drop(file);
    }

    save_pending_update(version, &installer_path);

    let _ = app.emit(
        "filemint://update-download-progress",
        UpdateProgressPayload {
            downloaded_bytes,
            total_bytes,
            percent: 100,
        },
    );

    Ok(())
}

pub fn launch_installer_detached(installer_path: &Path) -> Result<(), String> {
    let update_dir = get_update_dir();
    if !installer_path.starts_with(&update_dir) {
        return Err("Chemin de l'installeur non sécurisé".to_string());
    }

    if !installer_path.exists() {
        return Err("Le fichier d'installation n'existe pas sur le disque.".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const DETACHED_PROCESS: u32 = 0x00000008;

        // /UPDATE: Performs in-place update without prompting to uninstall previous version
        // /P: Passive mode (displays non-interactive progress bar, zero wizard prompts)
        // /R: Restarts FileMint automatically once installation completes
        std::process::Command::new(installer_path)
            .args(["/UPDATE", "/P", "/R"])
            .creation_flags(DETACHED_PROCESS)
            .spawn()
            .map_err(|e| format!("Impossible de lancer l'installeur : {}", e))?;
        Ok(())
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(installer_path)
            .spawn()
            .map_err(|e| format!("Impossible d'ouvrir l'image disque : {}", e))?;
        Ok(())
    }

    #[cfg(target_os = "linux")]
    {
        use std::os::unix::fs::PermissionsExt;
        if let Ok(metadata) = std::fs::metadata(installer_path) {
            let mut perms = metadata.permissions();
            perms.set_mode(0o755);
            let _ = std::fs::set_permissions(installer_path, perms);
        }

        std::process::Command::new(installer_path)
            .spawn()
            .map_err(|e| format!("Impossible de lancer la nouvelle version : {}", e))?;
        Ok(())
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        Err("Plateforme non supportée pour l'auto-mise à jour".to_string())
    }
}

pub fn install_update_and_restart(app: &AppHandle) -> Result<(), String> {
    let pending = read_pending_update()
        .ok_or_else(|| "Aucune mise à jour téléchargée trouvée.".to_string())?;

    let installer_path = PathBuf::from(&pending.installer_path);
    if !installer_path.exists() {
        clear_pending_update();
        return Err("Le fichier d'installation est introuvable.".to_string());
    }

    clear_pending_update();

    launch_installer_detached(&installer_path)?;

    std::thread::sleep(Duration::from_millis(200));
    app.exit(0);
    Ok(())
}

pub fn apply_pending_update_on_startup() -> bool {
    let current_version = env!("CARGO_PKG_VERSION");
    if let Some(pending) = read_pending_update() {
        if is_newer_version(&pending.version, current_version) {
            let installer_path = PathBuf::from(&pending.installer_path);
            let update_dir = get_update_dir();
            if installer_path.starts_with(&update_dir) && installer_path.exists() {
                clear_pending_update();
                if launch_installer_detached(&installer_path).is_ok() {
                    return true;
                }
            } else {
                clear_pending_update();
            }
        } else {
            clear_pending_update();
            let _ = std::fs::remove_file(&pending.installer_path);
        }
    }
    false
}

pub async fn download_and_install(
    app: &AppHandle,
    download_url: &str,
    asset_name: &str,
    version: &str,
) -> Result<(), String> {
    let ver = if !version.trim().is_empty() {
        version.trim()
    } else {
        asset_name
            .split('_')
            .nth(1)
            .unwrap_or("")
            .split('-')
            .next()
            .unwrap_or("")
    };
    download_update(app, download_url, asset_name, ver).await?;
    install_update_and_restart(app)
}

pub fn is_newer_version(latest: &str, current: &str) -> bool {
    let parse_v = |s: &str| -> Option<semver::Version> {
        let trimmed = s.trim().trim_start_matches('v');
        semver::Version::parse(trimmed).ok()
    };

    match (parse_v(latest), parse_v(current)) {
        (Some(l), Some(c)) => l > c,
        _ => {
            let clean = |s: &str| -> Vec<u32> {
                let base = s
                    .trim()
                    .trim_start_matches('v')
                    .split('-')
                    .next()
                    .unwrap_or(s);
                base.split('.')
                    .filter_map(|p| p.parse::<u32>().ok())
                    .collect()
            };

            let latest_parts = clean(latest);
            let current_parts = clean(current);

            latest_parts > current_parts
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_newer_version() {
        assert!(is_newer_version("1.7.1", "1.7.0"));
        assert!(is_newer_version("1.8.0", "1.7.9"));
        assert!(is_newer_version("1.8.0-beta.1", "1.7.9"));
        assert!(is_newer_version("2.0.0", "1.9.9"));
        assert!(!is_newer_version("1.7.0", "1.7.0"));
        assert!(!is_newer_version("1.6.9", "1.7.0"));
        assert!(!is_newer_version("1.7.0-beta.1", "1.7.0"));
    }
}
