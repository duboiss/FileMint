#[cfg(windows)]
pub mod windows {
    use tauri::{AppHandle, Emitter, Manager};
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::windows::named_pipe::{ClientOptions, ServerOptions};

    fn get_pipe_name() -> String {
        let user = std::env::var("USERNAME").unwrap_or_else(|_| "default".to_string());
        let sanitized: String = user
            .chars()
            .filter(|c| c.is_alphanumeric() || *c == '_' || *c == '-')
            .collect();
        format!(r"\\.\pipe\filemint_single_instance_pipe_{}", sanitized)
    }

    /// Sends file paths to an already running instance via named pipe. Returns true if delivered.
    pub fn try_send_to_existing_instance(files: &[String]) -> bool {
        if files.is_empty() {
            return try_send_payload(b"[]");
        }

        if let Ok(json_data) = serde_json::to_vec(files) {
            try_send_payload(&json_data)
        } else {
            false
        }
    }

    fn try_send_payload(payload: &[u8]) -> bool {
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build();

        let Ok(rt) = rt else { return false };

        rt.block_on(async {
            let pipe_name = get_pipe_name();
            // Connect to named pipe server
            let client = ClientOptions::new().open(&pipe_name);
            if let Ok(mut client) = client {
                let len = (payload.len() as u32).to_le_bytes();
                if client.write_all(&len).await.is_err() {
                    return false;
                }
                if client.write_all(payload).await.is_err() {
                    return false;
                }
                let _ = client.flush().await;
                true
            } else {
                false
            }
        })
    }

    /// Starts the named pipe IPC server in the primary instance
    pub fn start_ipc_server(app_handle: AppHandle) {
        tauri::async_runtime::spawn(async move {
            let mut is_first = true;
            let pipe_name = get_pipe_name();

            loop {
                let server_result = if is_first {
                    is_first = false;
                    ServerOptions::new()
                        .first_pipe_instance(true)
                        .create(&pipe_name)
                } else {
                    ServerOptions::new().create(&pipe_name)
                };

                let Ok(mut server) = server_result else {
                    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
                    continue;
                };

                // Wait for client connection
                if server.connect().await.is_ok() {
                    let mut len_bytes = [0u8; 4];
                    if server.read_exact(&mut len_bytes).await.is_ok() {
                        let len = u32::from_le_bytes(len_bytes) as usize;
                        if len > 0 && len < 10 * 1024 * 1024 {
                            let mut buf = vec![0u8; len];
                            if server.read_exact(&mut buf).await.is_ok() {
                                if let Ok(paths) = serde_json::from_slice::<Vec<String>>(&buf) {
                                    // [SEC-07] Validate incoming paths: must exist and be regular files
                                    let valid_paths: Vec<String> = paths
                                        .into_iter()
                                        .filter(|p| {
                                            let path = std::path::Path::new(p);
                                            path.exists() && path.is_file()
                                        })
                                        .collect();

                                    if let Some(window) = app_handle.get_webview_window("main") {
                                        let _ = window.show();
                                        let _ = window.unminimize();
                                        let _ = window.set_focus();
                                        if !valid_paths.is_empty() {
                                            let _ =
                                                window.emit("filemint://cli-files", valid_paths);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });
    }
}

#[cfg(not(windows))]
pub mod windows {
    use tauri::AppHandle;

    pub fn try_send_to_existing_instance(_files: &[String]) -> bool {
        false
    }

    pub fn start_ipc_server(_app_handle: AppHandle) {}
}
