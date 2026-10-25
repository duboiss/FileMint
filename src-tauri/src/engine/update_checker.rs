use serde::{Deserialize, Serialize};
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
    })
}

pub async fn download_and_install(
    app: &AppHandle,
    download_url: &str,
    asset_name: &str,
) -> Result<(), String> {
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

    let temp_dir = std::env::temp_dir();
    let installer_path = temp_dir.join(asset_name);

    let mut file = File::create(&installer_path)
        .await
        .map_err(|e| format!("Impossible de créer le fichier temporaire : {}", e))?;

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

    let _ = app.emit(
        "filemint://update-download-progress",
        UpdateProgressPayload {
            downloaded_bytes,
            total_bytes,
            percent: 100,
        },
    );

    tokio::time::sleep(Duration::from_millis(600)).await;

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new(&installer_path)
            .spawn()
            .map_err(|e| format!("Impossible de lancer l'installeur : {}", e))?;

        tokio::time::sleep(Duration::from_millis(400)).await;
        app.exit(0);
        Ok(())
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&installer_path)
            .spawn()
            .map_err(|e| format!("Impossible d'ouvrir l'image disque : {}", e))?;

        tokio::time::sleep(Duration::from_millis(400)).await;
        app.exit(0);
        Ok(())
    }

    #[cfg(target_os = "linux")]
    {
        use std::os::unix::fs::PermissionsExt;
        if let Ok(metadata) = std::fs::metadata(&installer_path) {
            let mut perms = metadata.permissions();
            perms.set_mode(0o755);
            let _ = std::fs::set_permissions(&installer_path, perms);
        }

        std::process::Command::new(&installer_path)
            .spawn()
            .map_err(|e| format!("Impossible de lancer la nouvelle version : {}", e))?;

        tokio::time::sleep(Duration::from_millis(400)).await;
        app.exit(0);
        Ok(())
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        Err("Plateforme non supportée pour l'auto-mise à jour".to_string())
    }
}

fn is_newer_version(latest: &str, current: &str) -> bool {
    let parse_parts =
        |s: &str| -> Vec<u32> { s.split('.').filter_map(|p| p.parse::<u32>().ok()).collect() };

    let latest_parts = parse_parts(latest);
    let current_parts = parse_parts(current);

    latest_parts > current_parts
}
