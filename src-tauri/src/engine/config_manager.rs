use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(default)]
pub struct AppConfig {
    pub language: Option<String>,
    pub theme: Option<String>,
    pub context_menu_mode: Option<String>,
    pub naming_pattern: Option<String>,
    pub subfolder_name: Option<String>,
    pub default_dest_mode: Option<String>,
    pub custom_folder: Option<String>,
    pub default_tab: Option<String>,
    pub default_preset: Option<String>,
    pub update_check: Option<bool>,
    pub lifetime_saved_bytes: Option<u64>,
    pub lifetime_files_count: Option<u64>,
    pub custom_profiles: Option<serde_json::Value>,
    pub watch_folders: Option<serde_json::Value>,
}

pub fn get_config_path() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| dirs::data_local_dir().unwrap_or_else(|| PathBuf::from(".")))
        .join("FileMint")
        .join("config.json")
}

pub fn load_config() -> AppConfig {
    let path = get_config_path();
    if !path.exists() {
        return AppConfig::default();
    }

    match std::fs::read_to_string(&path) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
        Err(e) => {
            eprintln!("Failed to read app config at {}: {}", path.display(), e);
            AppConfig::default()
        }
    }
}

pub fn save_config(config: &AppConfig) -> Result<(), String> {
    let path = get_config_path();
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    let json = serde_json::to_string_pretty(config)
        .map_err(|e| format!("Failed to serialize app config: {}", e))?;

    let temp_path = path.with_extension("tmp");
    if std::fs::write(&temp_path, &json).is_ok() {
        if std::fs::rename(&temp_path, &path).is_ok() {
            return Ok(());
        }
        let _ = std::fs::remove_file(&path);
        if std::fs::rename(&temp_path, &path).is_ok() {
            return Ok(());
        }
        let _ = std::fs::remove_file(&temp_path);
    }

    // Direct write fallback
    std::fs::write(&path, json).map_err(|e| format!("Failed to write app config: {}", e))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_app_config_serde() {
        let config = AppConfig {
            language: Some("fr".to_string()),
            theme: Some("dark".to_string()),
            lifetime_saved_bytes: Some(1024),
            ..Default::default()
        };

        let json = serde_json::to_string(&config).unwrap();
        let decoded: AppConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(decoded.language.as_deref(), Some("fr"));
        assert_eq!(decoded.theme.as_deref(), Some("dark"));
        assert_eq!(decoded.lifetime_saved_bytes, Some(1024));
    }
}
