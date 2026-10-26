use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

static TEMP_COUNTER: AtomicU64 = AtomicU64::new(0);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DestinationMode {
    FileMintSubfolder, // Creates a dedicated FileMint subfolder next to original
    SameAsOriginal,    // Saves in same directory as original
    Custom(String),    // Saves in user-selected directory
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DestinationConfig {
    pub mode: DestinationMode,
    pub custom_suffix: Option<String>,
    #[serde(default)]
    pub naming_pattern: Option<String>,
    pub overwrite_existing: bool,
    #[serde(default)]
    pub subfolder_name: Option<String>,
}

impl Default for DestinationConfig {
    fn default() -> Self {
        Self {
            mode: DestinationMode::FileMintSubfolder,
            custom_suffix: None,
            naming_pattern: None,
            overwrite_existing: false,
            subfolder_name: None,
        }
    }
}

#[derive(Debug, Clone, Default)]
pub struct NamingContext {
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub quality: Option<u8>,
    pub index: usize,
    pub pdf_profile: Option<String>,
}

pub fn expand_naming_pattern(
    pattern: &str,
    original_stem: &str,
    target_extension: &str,
    context: &NamingContext,
) -> String {
    let now = chrono::Local::now();
    let date_str = now.format("%Y-%m-%d").to_string();
    let year_str = now.format("%Y").to_string();
    let month_str = now.format("%m").to_string();
    let day_str = now.format("%d").to_string();

    let width_str = context.width.map(|w| w.to_string()).unwrap_or_default();
    let height_str = context.height.map(|h| h.to_string()).unwrap_or_default();
    let quality_str = context.quality.map(|q| q.to_string()).unwrap_or_default();
    let index_2 = format!("{:02}", context.index);
    let index_3 = format!("{:03}", context.index);
    let index_raw = context.index.to_string();

    let profile_fr = match context.pdf_profile.as_deref() {
        Some("readable") | Some("Readable") | Some("lisible") => "lisible",
        Some("balanced") | Some("Balanced") | Some("equilibre") => "equilibre",
        Some("compact") | Some("Compact") => "compact",
        Some(s) => s,
        None => "",
    };
    let profile_en = match context.pdf_profile.as_deref() {
        Some("readable") | Some("Readable") | Some("lisible") => "readable",
        Some("balanced") | Some("Balanced") | Some("equilibre") => "balanced",
        Some("compact") | Some("Compact") => "compact",
        Some(s) => s,
        None => "",
    };

    let mut result = pattern.to_string();

    // If context has no pixel dimensions, cleanly remove dimension tokens so they don't leave dangling chars (e.g. "_x_")
    if context.width.is_none() && context.height.is_none() {
        result = result.replace("_{largeur}x{hauteur}", "");
        result = result.replace("_{width}x{height}", "");
        result = result.replace("{largeur}x{hauteur}", "");
        result = result.replace("{width}x{height}", "");
        result = result.replace("_{largeur}", "");
        result = result.replace("_{hauteur}", "");
        result = result.replace("_{width}", "");
        result = result.replace("_{height}", "");
    }

    // If context has no quality, cleanly remove quality tokens
    if context.quality.is_none() {
        result = result.replace("_q{qualite}", "");
        result = result.replace("_q{qualité}", "");
        result = result.replace("_q{quality}", "");
        result = result.replace("_{qualite}", "");
        result = result.replace("_{qualité}", "");
        result = result.replace("_{quality}", "");
    }

    // If context has no PDF profile, cleanly remove profile tokens
    if context.pdf_profile.is_none() {
        result = result.replace("_{profil}", "");
        result = result.replace("_{profile}", "");
    } else {
        // For PDF, format/ext tokens in stem are redundant (extension is always .pdf)
        result = result.replace("_{format}", "");
        result = result.replace("_{ext}", "");
        result = result.replace("{format}", "");
        result = result.replace("{ext}", "");
    }

    let replacements: [(&str, &str); 30] = [
        ("{nom}", original_stem),
        ("{name}", original_stem),
        ("{largeur}", &width_str),
        ("{width}", &width_str),
        ("{w}", &width_str),
        ("{hauteur}", &height_str),
        ("{height}", &height_str),
        ("{h}", &height_str),
        ("{qualite}", &quality_str),
        ("{qualité}", &quality_str),
        ("{quality}", &quality_str),
        ("{q}", &quality_str),
        ("{profil}", profile_fr),
        ("{profile}", profile_en),
        ("{index3}", &index_3),
        ("{compteur3}", &index_3),
        ("{index}", &index_2),
        ("{compteur}", &index_2),
        ("{count}", &index_2),
        ("{i}", &index_raw),
        ("{date}", &date_str),
        ("{annee}", &year_str),
        ("{année}", &year_str),
        ("{year}", &year_str),
        ("{mois}", &month_str),
        ("{month}", &month_str),
        ("{jour}", &day_str),
        ("{day}", &day_str),
        ("{format}", target_extension),
        ("{ext}", target_extension),
    ];

    for (needle, replacement) in replacements {
        result = result.replace(needle, replacement);
    }

    // Sanitize forbidden characters for filesystems (/ \ : * ? " < > |)
    let sanitized: String = result
        .chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            c if c.is_control() => '_',
            c => c,
        })
        .collect();

    // Clean up duplicate separators that could remain from omitted variables
    let mut cleaned = sanitized;
    while cleaned.contains("__") {
        cleaned = cleaned.replace("__", "_");
    }
    while cleaned.contains("--") {
        cleaned = cleaned.replace("--", "-");
    }
    cleaned = cleaned.replace("-_", "_").replace("_-", "_");

    let trimmed = cleaned
        .trim()
        .trim_matches(|c| c == '_' || c == '-' || c == '.');
    if trimmed.is_empty() {
        original_stem.to_string()
    } else {
        trimmed.to_string()
    }
}

pub struct TempFileGuard {
    pub path: PathBuf,
    committed: bool,
}

impl TempFileGuard {
    pub fn new(path: PathBuf) -> Self {
        Self {
            path,
            committed: false,
        }
    }

    pub fn commit(mut self) {
        self.committed = true;
    }
}

impl Drop for TempFileGuard {
    fn drop(&mut self) {
        if !self.committed && self.path.exists() {
            let _ = fs::remove_file(&self.path);
        }
    }
}

pub fn validate_and_sanitize_destination_dir(path_str: &str) -> Result<PathBuf> {
    let trimmed = path_str.trim();
    if trimmed.is_empty() || trimmed.contains('\0') || trimmed.contains("..") {
        return Err(anyhow!(
            "Chemin de destination invalide ou interdit ('..' et null bytes proscrits)"
        ));
    }

    let p = PathBuf::from(trimmed);
    if !p.exists() {
        fs::create_dir_all(&p)?;
    }

    let canonical = p.canonicalize().unwrap_or(p);
    let canonical_str = canonical.to_string_lossy().to_lowercase();

    #[cfg(target_os = "windows")]
    {
        let system_root = std::env::var("SystemRoot")
            .unwrap_or_else(|_| "c:\\windows".to_string())
            .to_lowercase();
        let program_files = std::env::var("ProgramFiles")
            .unwrap_or_else(|_| "c:\\program files".to_string())
            .to_lowercase();
        let program_files_x86 = std::env::var("ProgramFiles(x86)")
            .unwrap_or_else(|_| "c:\\program files (x86)".to_string())
            .to_lowercase();

        let clean_canonical = canonical_str.trim_start_matches(r"\\?\");

        if clean_canonical == "c:\\"
            || clean_canonical == "d:\\"
            || clean_canonical == "e:\\"
            || clean_canonical == system_root
            || clean_canonical.starts_with(&(system_root.clone() + "\\"))
            || clean_canonical == program_files
            || clean_canonical.starts_with(&(program_files.clone() + "\\"))
            || clean_canonical == program_files_x86
            || clean_canonical.starts_with(&(program_files_x86 + "\\"))
        {
            return Err(anyhow!(
                "Destination système interdite : les répertoires système et racines de disques ne sont pas autorisés"
            ));
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let forbidden_roots = [
            "/etc", "/bin", "/sbin", "/usr", "/root", "/sys", "/proc", "/dev", "/boot", "/System",
            "/Library",
        ];
        if canonical_str == "/"
            || forbidden_roots.iter().any(|&root| {
                canonical_str == root || canonical_str.starts_with(&format!("{}/", root))
            })
        {
            return Err(anyhow!("Destination système interdite"));
        }
    }

    Ok(canonical)
}

pub fn resolve_output_path(
    input_path: &Path,
    target_extension: Option<&str>,
    config: &DestinationConfig,
    context: Option<&NamingContext>,
) -> Result<PathBuf> {
    let parent_dir = input_path.parent().unwrap_or_else(|| Path::new("."));
    let stem = input_path
        .file_stem()
        .and_then(|s| s.to_str())
        .ok_or_else(|| anyhow!("Nom de fichier invalide"))?;

    let original_ext = input_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("");

    let final_ext = target_extension.unwrap_or(original_ext);

    let target_dir = match &config.mode {
        DestinationMode::FileMintSubfolder => {
            let folder_name = config
                .subfolder_name
                .as_deref()
                .map(|s| s.trim())
                .filter(|s| !s.is_empty())
                .unwrap_or("FileMint");

            // [SEC-05] Prevent path traversal
            if folder_name.contains('/') || folder_name.contains('\\') || folder_name.contains("..")
            {
                return Err(anyhow!("Nom de sous-dossier invalide : les séparateurs de chemin et '..' sont interdits"));
            }

            let subfolder = parent_dir.join(folder_name);
            if !subfolder.exists() {
                fs::create_dir_all(&subfolder)?;
            }
            subfolder
        }
        DestinationMode::SameAsOriginal => parent_dir.to_path_buf(),
        DestinationMode::Custom(path_str) => validate_and_sanitize_destination_dir(path_str)?,
    };

    let default_ctx = NamingContext::default();
    let ctx = context.unwrap_or(&default_ctx);

    let base_name = if let Some(ref pattern) = config.naming_pattern {
        if !pattern.trim().is_empty() {
            expand_naming_pattern(pattern, stem, final_ext, ctx)
        } else if let Some(ref suffix) = config.custom_suffix {
            format!("{}-{}", stem, suffix)
        } else {
            stem.to_string()
        }
    } else if let Some(ref suffix) = config.custom_suffix {
        format!("{}-{}", stem, suffix)
    } else {
        stem.to_string()
    };

    let mut candidate = target_dir.join(format!("{}.{}", base_name, final_ext));

    if config.overwrite_existing {
        return Ok(candidate);
    }

    // Prevent accidental overwrites: generate unique filename "name (1).ext"
    let mut counter = 1;
    while candidate.exists() {
        candidate = target_dir.join(format!("{} ({}).{}", base_name, counter, final_ext));
        counter += 1;
    }

    Ok(candidate)
}

pub fn create_temp_target(final_path: &Path) -> Result<(PathBuf, TempFileGuard)> {
    let parent = final_path.parent().unwrap_or_else(|| Path::new("."));
    let stem = final_path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("mint");
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let counter = TEMP_COUNTER.fetch_add(1, Ordering::Relaxed);

    let temp_name = format!(".{}_{}_{}.tmp", stem, timestamp, counter);
    let temp_path = parent.join(temp_name);

    let guard = TempFileGuard::new(temp_path.clone());
    Ok((temp_path, guard))
}

pub fn commit_temp_file(temp_path: &Path, final_path: &Path, guard: TempFileGuard) -> Result<()> {
    if !temp_path.exists() {
        return Err(anyhow!(
            "Le fichier temporaire n'existe pas : {:?}",
            temp_path
        ));
    }
    fs::rename(temp_path, final_path)?;
    guard.commit();
    Ok(())
}

pub fn open_directory_in_explorer(path: &Path) -> Result<()> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        if path.is_file() {
            Command::new("explorer").arg("/select,").arg(path).spawn()?;
        } else {
            Command::new("explorer").arg(path).spawn()?;
        }
    }

    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        if path.is_file() {
            Command::new("open").arg("-R").arg(path).spawn()?;
        } else {
            Command::new("open").arg(path).spawn()?;
        }
    }

    #[cfg(target_os = "linux")]
    {
        use std::process::Command;
        let target = if path.is_file() {
            path.parent().unwrap_or(path)
        } else {
            path
        };
        Command::new("xdg-open").arg(target).spawn()?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_resolve_output_subfolder() {
        let input = Path::new("tests/sample.jpg");
        let config = DestinationConfig {
            mode: DestinationMode::FileMintSubfolder,
            custom_suffix: None,
            naming_pattern: None,
            overwrite_existing: true,
            subfolder_name: None,
        };
        let out = resolve_output_path(input, Some("webp"), &config, None).unwrap();
        assert_eq!(out, Path::new("tests/FileMint/sample.webp"));
    }

    #[test]
    fn test_resolve_output_custom_subfolder_name() {
        let input = Path::new("tests/sample.jpg");
        let config = DestinationConfig {
            mode: DestinationMode::FileMintSubfolder,
            custom_suffix: None,
            naming_pattern: None,
            overwrite_existing: true,
            subfolder_name: Some("Optimized_Files".to_string()),
        };
        let out = resolve_output_path(input, Some("webp"), &config, None).unwrap();
        assert_eq!(out, Path::new("tests/Optimized_Files/sample.webp"));
    }

    #[test]
    fn test_resolve_output_custom_suffix() {
        let input = Path::new("tests/document.pdf");
        let config = DestinationConfig {
            mode: DestinationMode::SameAsOriginal,
            custom_suffix: Some("compressed".to_string()),
            naming_pattern: None,
            overwrite_existing: true,
            subfolder_name: None,
        };
        let out = resolve_output_path(input, None, &config, None).unwrap();
        assert_eq!(out, Path::new("tests/document-compressed.pdf"));
    }

    #[test]
    fn test_resolve_output_naming_pattern() {
        let input = Path::new("tests/photo.png");
        let config = DestinationConfig {
            mode: DestinationMode::SameAsOriginal,
            custom_suffix: None,
            naming_pattern: Some("{nom}_w{largeur}_q{qualite}_{index}".to_string()),
            overwrite_existing: true,
            subfolder_name: None,
        };
        let ctx = NamingContext {
            width: Some(1920),
            height: Some(1080),
            quality: Some(85),
            index: 2,
            pdf_profile: None,
        };
        let out = resolve_output_path(input, Some("webp"), &config, Some(&ctx)).unwrap();
        assert_eq!(out, Path::new("tests/photo_w1920_q85_02.webp"));
    }

    #[test]
    fn test_pdf_naming_pattern_with_profile() {
        let input = Path::new("tests/facture.pdf");
        let config = DestinationConfig {
            mode: DestinationMode::SameAsOriginal,
            custom_suffix: None,
            naming_pattern: Some("{nom}_{profil}".to_string()),
            overwrite_existing: true,
            subfolder_name: None,
        };
        let ctx = NamingContext {
            width: None,
            height: None,
            quality: None,
            index: 1,
            pdf_profile: Some("compact".to_string()),
        };
        let out = resolve_output_path(input, Some("pdf"), &config, Some(&ctx)).unwrap();
        assert_eq!(out, Path::new("tests/facture_compact.pdf"));
    }

    #[test]
    fn test_pdf_graceful_fallback_for_image_tokens() {
        let input = Path::new("tests/scan.pdf");
        // Pattern specifies image tokens: {largeur}x{hauteur} and q{qualite}
        let config = DestinationConfig {
            mode: DestinationMode::SameAsOriginal,
            custom_suffix: None,
            naming_pattern: Some("{nom}_{largeur}x{hauteur}_q{qualite}".to_string()),
            overwrite_existing: true,
            subfolder_name: None,
        };
        let ctx = NamingContext {
            width: None,
            height: None,
            quality: None,
            index: 1,
            pdf_profile: None,
        };
        let out = resolve_output_path(input, Some("pdf"), &config, Some(&ctx)).unwrap();
        // Tokens should be cleanly stripped rather than leaving "_x_" or "_q"
        assert_eq!(out, Path::new("tests/scan.pdf"));
    }

    #[test]
    fn test_pdf_naming_removes_redundant_format() {
        let input = Path::new("tests/report.pdf");
        let config = DestinationConfig {
            mode: DestinationMode::SameAsOriginal,
            custom_suffix: None,
            naming_pattern: Some("{nom}_{format}".to_string()),
            overwrite_existing: true,
            subfolder_name: None,
        };
        let ctx = NamingContext {
            width: None,
            height: None,
            quality: None,
            index: 1,
            pdf_profile: Some("compact".to_string()),
        };
        let out = resolve_output_path(input, Some("pdf"), &config, Some(&ctx)).unwrap();
        assert_eq!(out, Path::new("tests/report.pdf"));
    }

    #[test]
    fn test_expand_naming_pattern_sanitization() {
        let ctx = NamingContext {
            width: Some(100),
            height: Some(100),
            quality: Some(50),
            index: 1,
            pdf_profile: None,
        };
        // Colon, question mark, slash should be sanitized to '_'
        let expanded = expand_naming_pattern("{nom}:version?/{index}", "file", "jpg", &ctx);
        assert_eq!(expanded, "file_version_01");
    }
}
