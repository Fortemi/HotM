//! Windows Registry management for HotM services
//! 
//! Handles service configuration storage, event log registration,
//! and registry-based configuration management.

use anyhow::{Context, Result, anyhow};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::{info, warn, error, debug};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegistryServiceConfig {
    pub service_name: String,
    pub display_name: String,
    pub description: String,
    pub executable_path: String,
    pub startup_type: u32,
    pub dependencies: Vec<String>,
    pub recovery_actions: Vec<RegistryRecoveryAction>,
    pub parameters: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegistryRecoveryAction {
    pub action_type: u32, // SC_ACTION_* constants
    pub delay_ms: u32,
}

pub struct RegistryManager {
    service_registry_path: String,
    config_registry_path: String,
}

impl RegistryManager {
    pub fn new() -> Result<Self> {
        Ok(Self {
            service_registry_path: "SYSTEM\\CurrentControlSet\\Services".to_string(),
            config_registry_path: "SOFTWARE\\HotM\\Configuration".to_string(),
        })
    }
    
    /// Register Windows Event Log source for HotM services
    pub fn register_event_source(&self) -> Result<()> {
        info!("Registering Windows Event Log source");
        
        #[cfg(windows)]
        {
            use std::ffi::CString;
            use winapi::um::winreg::*;
            use winapi::shared::minwindef::*;
            use std::ptr;
            
            let source_name = "HotM-ServiceManager";
            let log_name = "Application";
            
            let registry_path = format!("SYSTEM\\CurrentControlSet\\Services\\EventLog\\{}\\{}", log_name, source_name);
            let registry_path_cstr = CString::new(registry_path)?;
            
            unsafe {
                let mut key_handle: HKEY = ptr::null_mut();
                
                let result = RegCreateKeyExA(
                    HKEY_LOCAL_MACHINE,
                    registry_path_cstr.as_ptr(),
                    0,
                    ptr::null_mut(),
                    REG_OPTION_NON_VOLATILE,
                    KEY_WRITE,
                    ptr::null_mut(),
                    &mut key_handle,
                    ptr::null_mut()
                );
                
                if result == 0 {
                    // Set event message file
                    let message_file = CString::new("C:\\Windows\\System32\\netmsg.dll")?;
                    let event_message_file = CString::new("EventMessageFile")?;
                    
                    RegSetValueExA(
                        key_handle,
                        event_message_file.as_ptr(),
                        0,
                        REG_EXPAND_SZ,
                        message_file.as_ptr() as *const u8,
                        message_file.as_bytes().len() as u32 + 1
                    );
                    
                    // Set supported event types
                    let types_supported = CString::new("TypesSupported")?;
                    let event_types: u32 = 0x0007; // EVENTLOG_ERROR_TYPE | EVENTLOG_WARNING_TYPE | EVENTLOG_INFORMATION_TYPE
                    
                    RegSetValueExA(
                        key_handle,
                        types_supported.as_ptr(),
                        0,
                        REG_DWORD,
                        &event_types as *const u32 as *const u8,
                        4
                    );
                    
                    RegCloseKey(key_handle);
                    info!("Event log source registered successfully");
                } else {
                    return Err(anyhow!("Failed to create registry key for event log source: {}", result));
                }
            }
        }
        
        Ok(())
    }
    
    /// Unregister Windows Event Log source
    pub fn unregister_event_source(&self) -> Result<()> {
        info!("Unregistering Windows Event Log source");
        
        #[cfg(windows)]
        {
            use std::ffi::CString;
            use winapi::um::winreg::*;
            
            let source_name = "HotM-ServiceManager";
            let log_name = "Application";
            
            let registry_path = format!("SYSTEM\\CurrentControlSet\\Services\\EventLog\\{}\\{}", log_name, source_name);
            let registry_path_cstr = CString::new(registry_path)?;
            
            unsafe {
                let result = RegDeleteKeyA(HKEY_LOCAL_MACHINE, registry_path_cstr.as_ptr());
                if result == 0 {
                    info!("Event log source unregistered successfully");
                } else {
                    warn!("Failed to unregister event log source: {}", result);
                }
            }
        }
        
        Ok(())
    }
    
    /// Save service configuration to registry
    pub fn save_service_config(&self, config: &RegistryServiceConfig) -> Result<()> {
        info!("Saving service configuration to registry: {}", config.service_name);
        
        #[cfg(windows)]
        {
            use std::ffi::CString;
            use winapi::um::winreg::*;
            use winapi::shared::minwindef::*;
            use std::ptr;
            
            let service_path = format!("{}\\{}", self.service_registry_path, config.service_name);
            let service_path_cstr = CString::new(service_path)?;
            
            unsafe {
                let mut key_handle: HKEY = ptr::null_mut();
                
                let result = RegOpenKeyExA(
                    HKEY_LOCAL_MACHINE,
                    service_path_cstr.as_ptr(),
                    0,
                    KEY_WRITE,
                    &mut key_handle
                );
                
                if result != 0 {
                    return Err(anyhow!("Failed to open service registry key: {}", result));
                }
                
                // Set service description
                let description_cstr = CString::new(config.description.as_str())?;
                let description_key = CString::new("Description")?;
                RegSetValueExA(
                    key_handle,
                    description_key.as_ptr(),
                    0,
                    REG_SZ,
                    description_cstr.as_ptr() as *const u8,
                    description_cstr.as_bytes().len() as u32 + 1
                );
                
                // Set startup type
                let start_key = CString::new("Start")?;
                RegSetValueExA(
                    key_handle,
                    start_key.as_ptr(),
                    0,
                    REG_DWORD,
                    &config.startup_type as *const u32 as *const u8,
                    4
                );
                
                // Set dependencies if any
                if !config.dependencies.is_empty() {
                    let dependencies_str = config.dependencies.join("\0") + "\0";
                    let dependencies_cstr = CString::new(dependencies_str)?;
                    let depend_on_service = CString::new("DependOnService")?;
                    
                    RegSetValueExA(
                        key_handle,
                        depend_on_service.as_ptr(),
                        0,
                        REG_MULTI_SZ,
                        dependencies_cstr.as_ptr() as *const u8,
                        dependencies_cstr.as_bytes().len() as u32 + 1
                    );
                }
                
                // Set recovery actions
                if !config.recovery_actions.is_empty() {
                    self.set_service_recovery_actions(key_handle, &config.recovery_actions)?;
                }
                
                // Set custom parameters
                if !config.parameters.is_empty() {
                    self.set_service_parameters(key_handle, &config.parameters)?;
                }
                
                RegCloseKey(key_handle);
                info!("Service configuration saved successfully");
            }
        }
        
        Ok(())
    }
    
    /// Load service configuration from registry
    pub fn load_service_config(&self, service_name: &str) -> Result<RegistryServiceConfig> {
        debug!("Loading service configuration from registry: {}", service_name);
        
        #[cfg(windows)]
        {
            use std::ffi::CString;
            use winapi::um::winreg::*;
            use winapi::shared::minwindef::*;
            use std::ptr;
            
            let service_path = format!("{}\\{}", self.service_registry_path, service_name);
            let service_path_cstr = CString::new(service_path)?;
            
            unsafe {
                let mut key_handle: HKEY = ptr::null_mut();
                
                let result = RegOpenKeyExA(
                    HKEY_LOCAL_MACHINE,
                    service_path_cstr.as_ptr(),
                    0,
                    KEY_READ,
                    &mut key_handle
                );
                
                if result != 0 {
                    return Err(anyhow!("Failed to open service registry key: {}", result));
                }
                
                // Read basic service information
                let display_name = self.read_registry_string(key_handle, "DisplayName")
                    .unwrap_or_else(|_| service_name.to_string());
                let description = self.read_registry_string(key_handle, "Description")
                    .unwrap_or_else(|_| "".to_string());
                let executable_path = self.read_registry_string(key_handle, "ImagePath")
                    .unwrap_or_else(|_| "".to_string());
                let startup_type = self.read_registry_dword(key_handle, "Start")
                    .unwrap_or(2); // SERVICE_AUTO_START
                
                // Read dependencies
                let dependencies = self.read_registry_multi_string(key_handle, "DependOnService")
                    .unwrap_or_else(|_| Vec::new());
                
                // Read recovery actions
                let recovery_actions = self.read_service_recovery_actions(key_handle)
                    .unwrap_or_else(|_| Vec::new());
                
                // Read parameters
                let parameters = self.read_service_parameters(key_handle)
                    .unwrap_or_else(|_| HashMap::new());
                
                RegCloseKey(key_handle);
                
                Ok(RegistryServiceConfig {
                    service_name: service_name.to_string(),
                    display_name,
                    description,
                    executable_path,
                    startup_type,
                    dependencies,
                    recovery_actions,
                    parameters,
                })
            }
        }
        #[cfg(not(windows))]
        {
            Err(anyhow!("Registry operations are only supported on Windows"))
        }
    }
    
    /// Save HotM configuration to registry
    pub fn save_hotm_config(&self, config: &HashMap<String, String>) -> Result<()> {
        info!("Saving HotM configuration to registry");
        
        #[cfg(windows)]
        {
            use std::ffi::CString;
            use winapi::um::winreg::*;
            use winapi::shared::minwindef::*;
            use std::ptr;
            
            let config_path_cstr = CString::new(self.config_registry_path.as_str())?;
            
            unsafe {
                let mut key_handle: HKEY = ptr::null_mut();
                
                let result = RegCreateKeyExA(
                    HKEY_LOCAL_MACHINE,
                    config_path_cstr.as_ptr(),
                    0,
                    ptr::null_mut(),
                    REG_OPTION_NON_VOLATILE,
                    KEY_WRITE,
                    ptr::null_mut(),
                    &mut key_handle,
                    ptr::null_mut()
                );
                
                if result == 0 {
                    for (key, value) in config {
                        let key_cstr = CString::new(key.as_str())?;
                        let value_cstr = CString::new(value.as_str())?;
                        
                        RegSetValueExA(
                            key_handle,
                            key_cstr.as_ptr(),
                            0,
                            REG_SZ,
                            value_cstr.as_ptr() as *const u8,
                            value_cstr.as_bytes().len() as u32 + 1
                        );
                    }
                    
                    RegCloseKey(key_handle);
                    info!("HotM configuration saved successfully");
                } else {
                    return Err(anyhow!("Failed to create HotM configuration registry key: {}", result));
                }
            }
        }
        
        Ok(())
    }
    
    /// Load HotM configuration from registry
    pub fn load_hotm_config(&self) -> Result<HashMap<String, String>> {
        debug!("Loading HotM configuration from registry");
        
        #[cfg(windows)]
        {
            use std::ffi::CString;
            use winapi::um::winreg::*;
            use winapi::shared::minwindef::*;
            use std::ptr;
            
            let config_path_cstr = CString::new(self.config_registry_path.as_str())?;
            let mut config = HashMap::new();
            
            unsafe {
                let mut key_handle: HKEY = ptr::null_mut();
                
                let result = RegOpenKeyExA(
                    HKEY_LOCAL_MACHINE,
                    config_path_cstr.as_ptr(),
                    0,
                    KEY_READ,
                    &mut key_handle
                );
                
                if result == 0 {
                    // Enumerate all values in the key
                    let mut index = 0;
                    loop {
                        let mut value_name = [0u8; 256];
                        let mut value_name_size = value_name.len() as u32;
                        let mut value_data = [0u8; 1024];
                        let mut value_data_size = value_data.len() as u32;
                        let mut value_type: u32 = 0;
                        
                        let enum_result = RegEnumValueA(
                            key_handle,
                            index,
                            value_name.as_mut_ptr() as *mut i8,
                            &mut value_name_size,
                            ptr::null_mut(),
                            &mut value_type,
                            value_data.as_mut_ptr(),
                            &mut value_data_size
                        );
                        
                        if enum_result != 0 {
                            break; // No more values
                        }
                        
                        if value_type == REG_SZ {
                            let name = String::from_utf8_lossy(&value_name[..value_name_size as usize])
                                .trim_end_matches('\0')
                                .to_string();
                            let value = String::from_utf8_lossy(&value_data[..value_data_size as usize])
                                .trim_end_matches('\0')
                                .to_string();
                            
                            config.insert(name, value);
                        }
                        
                        index += 1;
                    }
                    
                    RegCloseKey(key_handle);
                }
            }
            
            Ok(config)
        }
        #[cfg(not(windows))]
        {
            Ok(HashMap::new())
        }
    }
    
    /// Delete HotM configuration from registry
    pub fn delete_hotm_config(&self) -> Result<()> {
        info!("Deleting HotM configuration from registry");
        
        #[cfg(windows)]
        {
            use std::ffi::CString;
            use winapi::um::winreg::*;
            
            let config_path_cstr = CString::new(self.config_registry_path.as_str())?;
            
            unsafe {
                let result = RegDeleteTreeA(HKEY_LOCAL_MACHINE, config_path_cstr.as_ptr());
                if result == 0 || result == 2 { // ERROR_FILE_NOT_FOUND is OK
                    info!("HotM configuration deleted successfully");
                } else {
                    warn!("Failed to delete HotM configuration: {}", result);
                }
            }
        }
        
        Ok(())
    }
    
    // Helper methods for Windows registry operations
    
    #[cfg(windows)]
    fn read_registry_string(&self, key_handle: winapi::shared::minwindef::HKEY, value_name: &str) -> Result<String> {
        use std::ffi::CString;
        use winapi::um::winreg::*;
        use winapi::shared::minwindef::*;
        use std::ptr;
        
        let value_name_cstr = CString::new(value_name)?;
        
        unsafe {
            let mut buffer = [0u8; 1024];
            let mut buffer_size = buffer.len() as u32;
            let mut value_type: u32 = 0;
            
            let result = RegQueryValueExA(
                key_handle,
                value_name_cstr.as_ptr(),
                ptr::null_mut(),
                &mut value_type,
                buffer.as_mut_ptr(),
                &mut buffer_size
            );
            
            if result == 0 && (value_type == REG_SZ || value_type == REG_EXPAND_SZ) {
                let value = String::from_utf8_lossy(&buffer[..buffer_size as usize])
                    .trim_end_matches('\0')
                    .to_string();
                Ok(value)
            } else {
                Err(anyhow!("Failed to read registry string: {}", result))
            }
        }
    }
    
    #[cfg(windows)]
    fn read_registry_dword(&self, key_handle: winapi::shared::minwindef::HKEY, value_name: &str) -> Result<u32> {
        use std::ffi::CString;
        use winapi::um::winreg::*;
        use winapi::shared::minwindef::*;
        use std::ptr;
        
        let value_name_cstr = CString::new(value_name)?;
        
        unsafe {
            let mut value: u32 = 0;
            let mut buffer_size = 4u32;
            let mut value_type: u32 = 0;
            
            let result = RegQueryValueExA(
                key_handle,
                value_name_cstr.as_ptr(),
                ptr::null_mut(),
                &mut value_type,
                &mut value as *mut u32 as *mut u8,
                &mut buffer_size
            );
            
            if result == 0 && value_type == REG_DWORD {
                Ok(value)
            } else {
                Err(anyhow!("Failed to read registry DWORD: {}", result))
            }
        }
    }
    
    #[cfg(windows)]
    fn read_registry_multi_string(&self, key_handle: winapi::shared::minwindef::HKEY, value_name: &str) -> Result<Vec<String>> {
        use std::ffi::CString;
        use winapi::um::winreg::*;
        use winapi::shared::minwindef::*;
        use std::ptr;
        
        let value_name_cstr = CString::new(value_name)?;
        
        unsafe {
            let mut buffer = [0u8; 1024];
            let mut buffer_size = buffer.len() as u32;
            let mut value_type: u32 = 0;
            
            let result = RegQueryValueExA(
                key_handle,
                value_name_cstr.as_ptr(),
                ptr::null_mut(),
                &mut value_type,
                buffer.as_mut_ptr(),
                &mut buffer_size
            );
            
            if result == 0 && value_type == REG_MULTI_SZ {
                let mut strings = Vec::new();
                let mut start = 0;
                
                for i in 0..buffer_size as usize {
                    if buffer[i] == 0 {
                        if i > start {
                            let string = String::from_utf8_lossy(&buffer[start..i]).to_string();
                            strings.push(string);
                        }
                        start = i + 1;
                    }
                }
                
                Ok(strings)
            } else {
                Err(anyhow!("Failed to read registry multi-string: {}", result))
            }
        }
    }
    
    #[cfg(windows)]
    fn set_service_recovery_actions(
        &self,
        key_handle: winapi::shared::minwindef::HKEY,
        recovery_actions: &[RegistryRecoveryAction]
    ) -> Result<()> {
        use winapi::um::winsvc::*;
        use std::mem;
        
        // Convert recovery actions to Windows format
        let mut actions: Vec<SC_ACTION> = recovery_actions.iter().map(|action| {
            SC_ACTION {
                Type: action.action_type,
                Delay: action.delay_ms,
            }
        }).collect();
        
        // Create failure actions structure
        let mut failure_actions = SERVICE_FAILURE_ACTIONSA {
            dwResetPeriod: 86400, // Reset after 24 hours
            lpRebootMsg: std::ptr::null_mut(),
            lpCommand: std::ptr::null_mut(),
            cActions: actions.len() as u32,
            lpsaActions: actions.as_mut_ptr(),
        };
        
        // This would require opening the service handle, which we'll do in the service module
        // For now, we'll store the configuration in a custom registry value
        Ok(())
    }
    
    #[cfg(windows)]
    fn read_service_recovery_actions(&self, key_handle: winapi::shared::minwindef::HKEY) -> Result<Vec<RegistryRecoveryAction>> {
        // Read custom recovery actions from registry
        // Implementation would depend on how we store the recovery actions
        Ok(Vec::new())
    }
    
    #[cfg(windows)]
    fn set_service_parameters(
        &self,
        key_handle: winapi::shared::minwindef::HKEY,
        parameters: &HashMap<String, String>
    ) -> Result<()> {
        use std::ffi::CString;
        use winapi::um::winreg::*;
        use winapi::shared::minwindef::*;
        use std::ptr;
        
        // Create Parameters subkey
        let parameters_key = CString::new("Parameters")?;
        let mut param_key_handle: winapi::shared::minwindef::HKEY = ptr::null_mut();
        
        unsafe {
            let result = RegCreateKeyExA(
                key_handle,
                parameters_key.as_ptr(),
                0,
                ptr::null_mut(),
                REG_OPTION_NON_VOLATILE,
                KEY_WRITE,
                ptr::null_mut(),
                &mut param_key_handle,
                ptr::null_mut()
            );
            
            if result == 0 {
                for (key, value) in parameters {
                    let key_cstr = CString::new(key.as_str())?;
                    let value_cstr = CString::new(value.as_str())?;
                    
                    RegSetValueExA(
                        param_key_handle,
                        key_cstr.as_ptr(),
                        0,
                        REG_SZ,
                        value_cstr.as_ptr() as *const u8,
                        value_cstr.as_bytes().len() as u32 + 1
                    );
                }
                
                RegCloseKey(param_key_handle);
            }
        }
        
        Ok(())
    }
    
    #[cfg(windows)]
    fn read_service_parameters(&self, key_handle: winapi::shared::minwindef::HKEY) -> Result<HashMap<String, String>> {
        use std::ffi::CString;
        use winapi::um::winreg::*;
        use winapi::shared::minwindef::*;
        use std::ptr;
        
        let parameters_key = CString::new("Parameters")?;
        let mut param_key_handle: winapi::shared::minwindef::HKEY = ptr::null_mut();
        let mut parameters = HashMap::new();
        
        unsafe {
            let result = RegOpenKeyExA(
                key_handle,
                parameters_key.as_ptr(),
                0,
                KEY_READ,
                &mut param_key_handle
            );
            
            if result == 0 {
                let mut index = 0;
                loop {
                    let mut value_name = [0u8; 256];
                    let mut value_name_size = value_name.len() as u32;
                    let mut value_data = [0u8; 1024];
                    let mut value_data_size = value_data.len() as u32;
                    let mut value_type: u32 = 0;
                    
                    let enum_result = RegEnumValueA(
                        param_key_handle,
                        index,
                        value_name.as_mut_ptr() as *mut i8,
                        &mut value_name_size,
                        ptr::null_mut(),
                        &mut value_type,
                        value_data.as_mut_ptr(),
                        &mut value_data_size
                    );
                    
                    if enum_result != 0 {
                        break;
                    }
                    
                    if value_type == REG_SZ {
                        let name = String::from_utf8_lossy(&value_name[..value_name_size as usize])
                            .trim_end_matches('\0')
                            .to_string();
                        let value = String::from_utf8_lossy(&value_data[..value_data_size as usize])
                            .trim_end_matches('\0')
                            .to_string();
                        
                        parameters.insert(name, value);
                    }
                    
                    index += 1;
                }
                
                RegCloseKey(param_key_handle);
            }
        }
        
        Ok(parameters)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_registry_manager_creation() {
        let registry_manager = RegistryManager::new().unwrap();
        assert!(!registry_manager.service_registry_path.is_empty());
        assert!(!registry_manager.config_registry_path.is_empty());
    }
    
    #[test]
    fn test_registry_service_config_creation() {
        let config = RegistryServiceConfig {
            service_name: "Test-Service".to_string(),
            display_name: "Test Service".to_string(),
            description: "A test service".to_string(),
            executable_path: "C:\\test\\service.exe".to_string(),
            startup_type: 2, // SERVICE_AUTO_START
            dependencies: vec!["TestDep1".to_string(), "TestDep2".to_string()],
            recovery_actions: vec![],
            parameters: HashMap::new(),
        };
        
        assert_eq!(config.service_name, "Test-Service");
        assert_eq!(config.dependencies.len(), 2);
    }
}