use anyhow::Result;
#[cfg(target_os = "windows")]
use std::path::{Path, PathBuf};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
#[cfg(target_os = "windows")]
use winreg::enums::*;
#[cfg(target_os = "windows")]
use winreg::RegKey;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[cfg(target_os = "windows")]
const SUPPORTED_EXTENSIONS: &[&str] = &[
    "image", ".jpg", ".jpeg", ".png", ".webp", ".avif", ".heic", ".heif", ".pdf", ".gif", ".bmp",
    ".tiff",
];

#[cfg(target_os = "windows")]
const REGISTER_SCRIPT: &str = include_str!("../../sparse_package/register.ps1");
#[cfg(target_os = "windows")]
const UNREGISTER_SCRIPT: &str = include_str!("../../sparse_package/unregister.ps1");

#[cfg(target_os = "windows")]
fn find_sparse_package_dir() -> Option<PathBuf> {
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            // Check application root directory
            if dir.join("FileMint.msix").exists() {
                return Some(dir.to_path_buf());
            }
            // Check sparse_package subfolder
            let sparse_dir = dir.join("sparse_package");
            if sparse_dir.join("FileMint.msix").exists() {
                return Some(sparse_dir);
            }
            // Check resources/sparse_package (Tauri production bundle)
            let res_dir = dir.join("resources").join("sparse_package");
            if res_dir.join("FileMint.msix").exists() {
                return Some(res_dir);
            }
        }
    }

    #[cfg(debug_assertions)]
    {
        let cargo_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("sparse_package");
        if cargo_dir.join("FileMint.msix").exists() {
            return Some(cargo_dir);
        }
    }

    None
}

#[cfg(target_os = "windows")]
fn notify_shell_change() {
    unsafe {
        use windows::Win32::UI::Shell::{SHChangeNotify, SHCNE_ASSOCCHANGED, SHCNF_IDLIST};
        SHChangeNotify(SHCNE_ASSOCCHANGED, SHCNF_IDLIST, None, None);
    }
}

#[cfg(target_os = "windows")]
pub fn register_context_menu(mode: &str, lang: Option<&str>) -> Result<()> {
    let current_exe = std::env::current_exe()?;
    let exe_path_str = current_exe.to_string_lossy().to_string();
    let app_dir = current_exe
        .parent()
        .unwrap_or_else(|| Path::new("."))
        .to_path_buf();

    // Ensure filemint_lib.dll is alongside filemint.exe
    let dll_target = app_dir.join("filemint_lib.dll");
    if !dll_target.exists() {
        if let Some(sparse_dir) = find_sparse_package_dir() {
            let sparse_dll = sparse_dir.join("filemint_lib.dll");
            if sparse_dll.exists() {
                let _ = std::fs::copy(&sparse_dll, &dll_target);
            } else if let Some(parent) = sparse_dir.parent() {
                let candidate_rel = parent
                    .join("target")
                    .join("release")
                    .join("filemint_lib.dll");
                let candidate_dbg = parent.join("target").join("debug").join("filemint_lib.dll");
                if candidate_rel.exists() {
                    let _ = std::fs::copy(&candidate_rel, &dll_target);
                } else if candidate_dbg.exists() {
                    let _ = std::fs::copy(&candidate_dbg, &dll_target);
                }
            }
        }
    }

    if mode == "disabled" {
        return unregister_context_menu();
    }

    if mode == "modern" {
        if let Some(sparse_dir) = find_sparse_package_dir() {
            let msix_path = sparse_dir.join("FileMint.msix");
            let cer_path = sparse_dir.join("filemint.cer");
            let script_invocation = format!(
                "$AppDir = '{}'; $MsixPath = '{}'; $CerPath = '{}';\n{}",
                app_dir.to_string_lossy().replace('\'', "''"),
                msix_path.to_string_lossy().replace('\'', "''"),
                cer_path.to_string_lossy().replace('\'', "''"),
                REGISTER_SCRIPT
            );

            let mut cmd = std::process::Command::new("powershell");
            cmd.creation_flags(CREATE_NO_WINDOW);
            cmd.args([
                "-NoProfile",
                "-WindowStyle",
                "Hidden",
                "-ExecutionPolicy",
                "Bypass",
                "-Command",
                &script_invocation,
            ]);
            let _ = cmd.output();
        }

        // Clean up classic keys to prevent duplicates in Explorer
        let _ = unregister_classic_keys();

        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        if let Ok((key, _)) = hkcu.create_subkey(r"Software\FileMint\ContextMenu") {
            let _ = key.set_value("Enabled", &1u32);
            let _ = key.set_value("Mode", &"modern");
        }
    } else {
        // Classic mode: unregister modern sparse package if present
        if let Some(_sparse_dir) = find_sparse_package_dir() {
            let mut cmd = std::process::Command::new("powershell");
            cmd.creation_flags(CREATE_NO_WINDOW);
            cmd.args([
                "-NoProfile",
                "-WindowStyle",
                "Hidden",
                "-ExecutionPolicy",
                "Bypass",
                "-Command",
                UNREGISTER_SCRIPT,
            ]);
            let _ = cmd.output();
        }

        register_classic_keys(&exe_path_str, lang)?;

        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        if let Ok((key, _)) = hkcu.create_subkey(r"Software\FileMint\ContextMenu") {
            let _ = key.set_value("Enabled", &1u32);
            let _ = key.set_value("Mode", &"classic");
        }
    }

    notify_shell_change();
    Ok(())
}

#[cfg(target_os = "windows")]
fn register_classic_keys(exe_path_str: &str, lang: Option<&str>) -> Result<()> {
    let command_str = format!("\"{}\" \"%1\"", exe_path_str);
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let is_en = lang == Some("en");

    for target in SUPPORTED_EXTENSIONS {
        let subkey_path = format!(
            r"Software\Classes\SystemFileAssociations\{}\shell\FileMint",
            target
        );
        let (key, _) = hkcu.create_subkey(&subkey_path)?;

        let label = if *target == ".pdf" {
            if is_en {
                "Compress with FileMint"
            } else {
                "Compresser avec FileMint"
            }
        } else {
            if is_en {
                "Optimize / Convert with FileMint"
            } else {
                "Optimiser / Convertir avec FileMint"
            }
        };

        key.set_value("", &label)?;
        key.set_value("Icon", &exe_path_str)?;
        key.set_value("IntegrationMode", &"classic")?;
        let _ = key.delete_value("Position");

        let (cmd_key, _) = hkcu.create_subkey(format!(r"{}\command", subkey_path))?;
        cmd_key.set_value("", &command_str)?;
    }

    Ok(())
}

#[cfg(target_os = "windows")]
fn unregister_classic_keys() -> Result<()> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    for target in SUPPORTED_EXTENSIONS {
        let subkey_path = format!(
            r"Software\Classes\SystemFileAssociations\{}\shell\FileMint",
            target
        );
        let _ = hkcu.delete_subkey_all(&subkey_path);
    }
    Ok(())
}

#[cfg(target_os = "windows")]
pub fn unregister_context_menu() -> Result<()> {
    // Unregister modern MSIX sparse package
    if let Some(_sparse_dir) = find_sparse_package_dir() {
        let mut cmd = std::process::Command::new("powershell");
        cmd.creation_flags(CREATE_NO_WINDOW);
        cmd.args([
            "-NoProfile",
            "-WindowStyle",
            "Hidden",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            UNREGISTER_SCRIPT,
        ]);
        let _ = cmd.output();
    }

    // Remove classic registry keys
    let _ = unregister_classic_keys();

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    if let Ok((key, _)) = hkcu.create_subkey(r"Software\FileMint\ContextMenu") {
        let _ = key.set_value("Enabled", &0u32);
        let _ = key.set_value("Mode", &"disabled");
    }

    notify_shell_change();
    Ok(())
}

#[cfg(target_os = "windows")]
pub fn is_context_menu_registered() -> bool {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    if let Ok(key) = hkcu.open_subkey(r"Software\FileMint\ContextMenu") {
        if let Ok(enabled) = key.get_value::<u32, _>("Enabled") {
            return enabled == 1;
        }
    }

    // Backward compatibility check
    hkcu.open_subkey(r"Software\Classes\SystemFileAssociations\image\shell\FileMint")
        .is_ok()
}

#[cfg(target_os = "windows")]
pub fn get_context_menu_mode() -> String {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    if let Ok(key) = hkcu.open_subkey(r"Software\FileMint\ContextMenu") {
        if let Ok(enabled) = key.get_value::<u32, _>("Enabled") {
            if enabled == 0 {
                return "disabled".to_string();
            }
        }
        if let Ok(mode) = key.get_value::<String, _>("Mode") {
            return mode;
        }
    }

    if let Ok(key) =
        hkcu.open_subkey(r"Software\Classes\SystemFileAssociations\image\shell\FileMint")
    {
        if let Ok(mode) = key.get_value::<String, _>("IntegrationMode") {
            return mode;
        }
    }

    "disabled".to_string()
}

#[cfg(not(target_os = "windows"))]
pub fn register_context_menu(_mode: &str, _lang: Option<&str>) -> Result<()> {
    Ok(())
}

#[cfg(not(target_os = "windows"))]
pub fn unregister_context_menu() -> Result<()> {
    Ok(())
}

#[cfg(not(target_os = "windows"))]
pub fn is_context_menu_registered() -> bool {
    false
}

#[cfg(not(target_os = "windows"))]
pub fn get_context_menu_mode() -> String {
    "modern".to_string()
}
