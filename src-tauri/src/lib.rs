pub mod commands;
pub mod engine;
pub mod shell;

#[cfg(windows)]
pub use shell::explorer_command::windows::{DllCanUnloadNow, DllGetClassObject};

use commands::AppState;
use engine::batch_runner::BatchRunner;
use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let args: Vec<String> = std::env::args()
        .skip(1)
        .filter(|a| !a.starts_with('-'))
        .filter(|a| std::path::Path::new(a).exists())
        .collect();

    // Forward arguments to existing instance if already running
    #[cfg(windows)]
    if shell::ipc_pipe::windows::try_send_to_existing_instance(&args) {
        return;
    }

    // Apply pending update if ready and opened normally
    if args.is_empty() && engine::update_checker::apply_pending_update_on_startup() {
        return;
    }

    // Primary instance: hold initial files for frontend mount
    let cancel_flag = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
    let app_state = AppState {
        runner: Mutex::new(BatchRunner::with_cancel_flag(cancel_flag.clone())),
        cancel_flag,
        cli_files: Mutex::new(args),
        watch_manager: engine::watch_folder::WatchFolderManager::new(),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            commands::get_files_metadata,
            commands::generate_image_preview,
            commands::start_batch_processing,
            commands::cancel_batch_processing,
            commands::open_path_in_explorer,
            commands::check_update,
            commands::download_update,
            commands::install_update,
            commands::download_and_install_update,
            commands::toggle_windows_context_menu,
            commands::get_windows_context_menu_status,
            commands::get_cli_files,
            commands::get_watch_folder_config,
            commands::set_watch_folder_config,
            commands::get_watch_folder_rules,
            commands::set_watch_folder_rules,
        ])
        .setup(|_app| {
            // Start named pipe IPC server to receive subsequent CLI / context menu files
            #[cfg(windows)]
            shell::ipc_pipe::windows::start_ipc_server(_app.handle().clone());

            // Safety fallback: ensure window is revealed after 1.5s if not already shown by frontend
            #[cfg(desktop)]
            {
                use tauri::Manager;
                if let Some(main_window) = _app.get_webview_window("main") {
                    let win = main_window.clone();
                    tauri::async_runtime::spawn(async move {
                        tokio::time::sleep(std::time::Duration::from_millis(1500)).await;
                        let _ = win.show();
                    });
                }
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Erreur lors de l'exécution de l'application FileMint");
}
