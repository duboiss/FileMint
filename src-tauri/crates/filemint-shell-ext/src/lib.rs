//! Windows 11 Explorer Command COM Shell Extension for FileMint.
//!
//! Provides the top-level modern context menu entry for Windows 11 File Explorer
//! via `IExplorerCommand` and forwards target paths to FileMint.

#[cfg(windows)]
mod shell_ext {
    #![allow(non_snake_case)]

    use std::ffi::c_void;
    use std::fs::OpenOptions;
    use std::io::Write;
    use std::path::PathBuf;
    use windows::Win32::Foundation::{
        BOOL, CLASS_E_CLASSNOTAVAILABLE, CLASS_E_NOAGGREGATION, E_NOTIMPL, E_POINTER, HMODULE,
        S_FALSE, S_OK,
    };
    use windows::Win32::System::LibraryLoader::{
        GetModuleFileNameW, GetModuleHandleExW, GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS,
    };
    use windows::Win32::UI::Shell::{IShellItemArray, SIGDN_FILESYSPATH};
    use windows_core::{implement, interface, GUID, HRESULT, PWSTR};

    pub const CLSID_FILEMINT_COMMAND: GUID =
        GUID::from_u128(0xc82b3a8a_4467_4d94_98ec_69488a08d9e1);

    #[interface("a08ce4d0-fa25-44ab-b57c-c7b1c323e0b9")]
    unsafe trait IExplorerCommand: windows_core::IUnknown {
        fn GetTitle(&self, psiItemArray: *mut c_void, ppszName: *mut PWSTR) -> HRESULT;
        fn GetIcon(&self, psiItemArray: *mut c_void, ppszIcon: *mut PWSTR) -> HRESULT;
        fn GetToolTip(&self, psiItemArray: *mut c_void, ppszInfoTip: *mut PWSTR) -> HRESULT;
        fn GetCanonicalName(&self, pguidCommandName: *mut GUID) -> HRESULT;
        fn GetState(
            &self,
            psiItemArray: *mut c_void,
            fOkToBeSlow: BOOL,
            pcmdState: *mut u32,
        ) -> HRESULT;
        fn Invoke(&self, psiItemArray: *mut c_void, pbc: *mut c_void) -> HRESULT;
        fn GetFlags(&self, pflags: *mut u32) -> HRESULT;
        fn EnumSubCommands(&self, ppEnum: *mut *mut c_void) -> HRESULT;
    }

    #[interface("00000001-0000-0000-c000-000000000046")]
    unsafe trait IClassFactory: windows_core::IUnknown {
        fn CreateInstance(
            &self,
            pUnkOuter: *mut c_void,
            riid: *const GUID,
            ppvObject: *mut *mut c_void,
        ) -> HRESULT;
        fn LockServer(&self, fLock: BOOL) -> HRESULT;
    }

    #[implement(IExplorerCommand)]
    pub struct FileMintExplorerCommand;

    impl IExplorerCommand_Impl for FileMintExplorerCommand_Impl {
        unsafe fn GetTitle(&self, _psi_item_array: *mut c_void, ppsz_name: *mut PWSTR) -> HRESULT {
            if ppsz_name.is_null() {
                return E_POINTER;
            }
            *ppsz_name = alloc_co_task_string("Optimiser / Convertir avec FileMint");
            S_OK
        }

        unsafe fn GetIcon(&self, _psi_item_array: *mut c_void, ppsz_icon: *mut PWSTR) -> HRESULT {
            if ppsz_icon.is_null() {
                return E_POINTER;
            }

            if let Some(exe_path) = get_filemint_exe_path() {
                if let Some(dir) = exe_path.parent() {
                    let ico_path = dir.join("icon.ico");
                    if ico_path.exists() {
                        *ppsz_icon = alloc_co_task_string(&ico_path.to_string_lossy());
                        return S_OK;
                    }
                }
                *ppsz_icon = alloc_co_task_string(&format!("{},0", exe_path.to_string_lossy()));
                return S_OK;
            }

            E_NOTIMPL
        }

        unsafe fn GetToolTip(
            &self,
            _psi_item_array: *mut c_void,
            ppsz_info_tip: *mut PWSTR,
        ) -> HRESULT {
            if ppsz_info_tip.is_null() {
                return E_POINTER;
            }
            *ppsz_info_tip = alloc_co_task_string("Compresser et convertir avec FileMint");
            S_OK
        }

        unsafe fn GetCanonicalName(&self, pguid_command_name: *mut GUID) -> HRESULT {
            if pguid_command_name.is_null() {
                return E_POINTER;
            }
            *pguid_command_name = CLSID_FILEMINT_COMMAND;
            S_OK
        }

        unsafe fn GetState(
            &self,
            _psi_item_array: *mut c_void,
            _f_ok_to_be_slow: BOOL,
            pcmd_state: *mut u32,
        ) -> HRESULT {
            if pcmd_state.is_null() {
                return E_POINTER;
            }
            // ECS_ENABLED = 0
            *pcmd_state = 0;
            S_OK
        }

        unsafe fn Invoke(&self, psi_item_array: *mut c_void, _pbc: *mut c_void) -> HRESULT {
            let paths = extract_paths_from_array(psi_item_array);

            // 1. Try sending to active instance via Named Pipe IPC
            if try_send_to_existing_instance(&paths) {
                return S_OK;
            }

            // 2. Fallback: spawn a new FileMint process with target paths
            if let Some(exe_path) = get_filemint_exe_path() {
                let mut cmd = std::process::Command::new(exe_path);
                for p in paths {
                    cmd.arg(p);
                }
                let _ = cmd.spawn();
            }

            S_OK
        }

        unsafe fn GetFlags(&self, pflags: *mut u32) -> HRESULT {
            if pflags.is_null() {
                return E_POINTER;
            }
            // ECF_DEFAULT = 0
            *pflags = 0;
            S_OK
        }

        unsafe fn EnumSubCommands(&self, pp_enum: *mut *mut c_void) -> HRESULT {
            if !pp_enum.is_null() {
                *pp_enum = std::ptr::null_mut();
            }
            E_NOTIMPL
        }
    }

    #[implement(IClassFactory)]
    pub struct FileMintClassFactory;

    impl IClassFactory_Impl for FileMintClassFactory_Impl {
        unsafe fn CreateInstance(
            &self,
            p_unk_outer: *mut c_void,
            riid: *const GUID,
            ppv_object: *mut *mut c_void,
        ) -> HRESULT {
            if ppv_object.is_null() {
                return E_POINTER;
            }
            *ppv_object = std::ptr::null_mut();

            if !p_unk_outer.is_null() {
                return CLASS_E_NOAGGREGATION;
            }

            let command: IExplorerCommand = FileMintExplorerCommand.into();
            windows_core::Interface::query(&command, riid, ppv_object)
        }

        unsafe fn LockServer(&self, _f_lock: BOOL) -> HRESULT {
            S_OK
        }
    }

    unsafe fn extract_paths_from_array(psi_item_array: *mut c_void) -> Vec<String> {
        let mut paths = Vec::new();
        if psi_item_array.is_null() {
            return paths;
        }

        if let Some(array) = windows_core::Interface::from_raw_borrowed(&psi_item_array) {
            let array: &IShellItemArray = array;
            if let Ok(count) = array.GetCount() {
                for i in 0..count {
                    if let Ok(item) = array.GetItemAt(i) {
                        if let Ok(pwstr) = item.GetDisplayName(SIGDN_FILESYSPATH) {
                            if let Ok(path_str) = pwstr.to_string() {
                                if !path_str.is_empty() {
                                    paths.push(path_str);
                                }
                            }
                            windows::Win32::System::Com::CoTaskMemFree(Some(
                                pwstr.as_ptr() as *const c_void,
                            ));
                        }
                    }
                }
            }
        }
        paths
    }

    fn get_pipe_name() -> String {
        let user = std::env::var("USERNAME").unwrap_or_else(|_| "default".to_string());
        let sanitized: String = user
            .chars()
            .filter(|c| c.is_alphanumeric() || *c == '_' || *c == '-')
            .collect();
        format!(r"\\.\pipe\filemint_single_instance_pipe_{}", sanitized)
    }

    fn try_send_to_existing_instance(files: &[String]) -> bool {
        if files.is_empty() {
            return false;
        }

        let payload = match serde_json::to_vec(files) {
            Ok(p) => p,
            Err(_) => return false,
        };

        let pipe_name = get_pipe_name();
        if let Ok(mut pipe) = OpenOptions::new().write(true).open(&pipe_name) {
            let len = (payload.len() as u32).to_le_bytes();
            if pipe.write_all(&len).is_ok() && pipe.write_all(&payload).is_ok() {
                let _ = pipe.flush();
                return true;
            }
        }

        false
    }

    pub fn get_filemint_exe_path() -> Option<PathBuf> {
        unsafe {
            let mut hmodule = HMODULE::default();
            if GetModuleHandleExW(
                GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS,
                windows_core::PCWSTR(get_filemint_exe_path as *const () as *const u16),
                &mut hmodule,
            )
            .is_ok()
            {
                let mut buf = [0u16; 1024];
                let len = GetModuleFileNameW(hmodule, &mut buf);
                if len > 0 {
                    let dll_path = String::from_utf16_lossy(&buf[..len as usize]);
                    let dll_path = PathBuf::from(dll_path);
                    if let Some(dir) = dll_path.parent() {
                        let exe_path = dir.join("filemint.exe");
                        if exe_path.exists() {
                            return Some(exe_path);
                        }
                    }
                }
            }
        }

        if let Ok(current_exe) = std::env::current_exe() {
            if let Some(file_name) = current_exe.file_name() {
                if file_name
                    .to_string_lossy()
                    .to_lowercase()
                    .contains("filemint")
                {
                    return Some(current_exe);
                }
            }
            if let Some(dir) = current_exe.parent() {
                let candidate = dir.join("filemint.exe");
                if candidate.exists() {
                    return Some(candidate);
                }
            }
        }

        let hkcu = winreg::RegKey::predef(winreg::enums::HKEY_CURRENT_USER);
        if let Ok(key) =
            hkcu.open_subkey(r"Software\Classes\SystemFileAssociations\image\shell\FileMint")
        {
            if let Ok(icon) = key.get_value::<String, _>("Icon") {
                let path = PathBuf::from(icon);
                if path.exists() {
                    return Some(path);
                }
            }
        }

        None
    }

    unsafe fn alloc_co_task_string(s: &str) -> PWSTR {
        let wide: Vec<u16> = s.encode_utf16().chain(std::iter::once(0)).collect();
        let bytes = wide.len() * std::mem::size_of::<u16>();
        let ptr = windows::Win32::System::Com::CoTaskMemAlloc(bytes) as *mut u16;
        if !ptr.is_null() {
            std::ptr::copy_nonoverlapping(wide.as_ptr(), ptr, wide.len());
        }
        PWSTR(ptr)
    }

    #[no_mangle]
    pub unsafe extern "system" fn DllGetClassObject(
        rclsid: *const GUID,
        riid: *const GUID,
        ppv: *mut *mut c_void,
    ) -> HRESULT {
        if ppv.is_null() || rclsid.is_null() || riid.is_null() {
            return E_POINTER;
        }
        *ppv = std::ptr::null_mut();

        if *rclsid == CLSID_FILEMINT_COMMAND {
            let factory: IClassFactory = FileMintClassFactory.into();
            windows_core::Interface::query(&factory, riid, ppv)
        } else {
            CLASS_E_CLASSNOTAVAILABLE
        }
    }

    #[no_mangle]
    pub unsafe extern "system" fn DllCanUnloadNow() -> HRESULT {
        S_FALSE
    }
}
