//! Desktop mode implementation for unified runtime

#[cfg(feature = "desktop")]
pub fn run_desktop() -> anyhow::Result<()> {
    use tracing::info;

    info!("Starting desktop application...");

    // Run the Tauri application on the main thread (this blocks until app closes)
    // Note: Tauri must run on the main thread for Windows event loop compatibility
    match run_tauri_app() {
        Ok(()) => Ok(()),
        Err(e) => Err(anyhow::anyhow!("Tauri application failed: {}", e)),
    }
}

#[cfg(feature = "desktop")]
fn run_tauri_app() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    use tauri::{
        Manager, WindowEvent,
    };
    use tauri_plugin_global_shortcut::GlobalShortcutExt;
    
    // Check for command line arguments
    let args: Vec<String> = std::env::args().collect();
    let start_minimized = args.contains(&"--minimized".to_string()) || 
                         args.contains(&"/minimized".to_string());

    let shortcut_plugin = tauri_plugin_global_shortcut::Builder::new()
        .with_handler(move |app, _shortcut, event| {
            // Handle hotkey events
            if event.state == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                if let Some(window) = app.get_webview_window("main") {
                    if window.is_visible().unwrap_or(false) {
                        let _ = window.hide();
                    } else {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            }
        })
        .build();

    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(shortcut_plugin)
        .invoke_handler(tauri::generate_handler![
            get_server_health,
            discover_servers,
            ensure_server_connection_command,
            create_note_command,
            get_note_command,
            update_note_command,
            delete_note_command,
            search_notes_command,
            semantic_search_command,
            get_note_provenance_command,
            set_note_tags_command,
            set_note_collection_command,
            render_plantuml,
            ensure_plantuml,
            // Service management commands
            crate::service_commands::get_service_status,
            crate::service_commands::start_service,
            crate::service_commands::stop_service,
            crate::service_commands::restart_service,
            crate::service_commands::get_system_health,
            crate::service_commands::repair_service,
            crate::service_commands::check_admin_privileges,
        ])
        .setup(move |app| {
            let _app_handle = app.handle().clone();
            
            // Perform service discovery at startup
            println!("HotM Desktop: Performing service discovery...");
            if let Some(server_url) = discover_local_server() {
                println!("HotM Desktop: Discovered server at: {}", server_url);
                std::env::set_var("HOTM_API_URL", &server_url);
            } else {
                println!("HotM Desktop: No servers discovered, using default URL");
            }
            
            // Register global shortcut for quick access
            let _ = app.global_shortcut()
                .register("CmdOrCtrl+Alt+H");
                // Note: handler is now registered in plugin setup

            // Setup system tray
            setup_system_tray(app)?;
            
            // If started with --minimized, hide the window
            if start_minimized {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            }
            
            Ok(())
        })
        .on_window_event(|window, event| {
            match event {
                WindowEvent::CloseRequested { api, .. } => {
                    // Hide to tray instead of closing
                    window.hide().unwrap();
                    api.prevent_close();
                }
                _ => {}
            }
        });

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
        
    Ok(())
}

#[cfg(feature = "desktop")]
fn setup_system_tray(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    use tauri::menu::{MenuBuilder, MenuItemBuilder};
    use tauri::tray::TrayIconBuilder;
    
    let show_item = MenuItemBuilder::new("Show Hall of Mind").id("show").build(app)?;
    let hide_item = MenuItemBuilder::new("Hide").id("hide").build(app)?;
    let quit_item = MenuItemBuilder::new("Quit").id("quit").build(app)?;
    let menu = MenuBuilder::new(app).items(&[&show_item, &hide_item, &quit_item]).build()?;

    let icon = create_default_icon();
    let _tray = TrayIconBuilder::new()
        .icon(icon)
        .menu(&menu)
        .tooltip("Hall of the Mind - Desktop")
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                use tauri::Manager;
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "hide" => {
                use tauri::Manager;
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .build(app)?;

    Ok(())
}

#[cfg(feature = "desktop")]
fn create_default_icon() -> tauri::image::Image<'static> {
    // Create a simple 32x32 RGBA icon
    let size = 32;
    let mut rgba = vec![0u8; (size * size * 4) as usize];
    
    // Fill with a simple purple brain pattern
    for y in 0..size {
        for x in 0..size {
            let idx = ((y * size + x) * 4) as usize;
            let center_x = size as f32 / 2.0;
            let center_y = size as f32 / 2.0;
            let distance = ((x as f32 - center_x).powi(2) + (y as f32 - center_y).powi(2)).sqrt();
            let max_distance = size as f32 / 2.0;
            
            if distance <= max_distance {
                let intensity = (1.0 - distance / max_distance) * 255.0;
                rgba[idx] = (0.4 * intensity) as u8;     // R
                rgba[idx + 1] = (0.2 * intensity) as u8; // G
                rgba[idx + 2] = (0.8 * intensity) as u8; // B
                rgba[idx + 3] = 255;                     // A
            }
        }
    }
    
    tauri::image::Image::new_owned(rgba, size, size)
}

// API command functions with service discovery
#[cfg(feature = "desktop")]
fn get_api_url() -> String {
    // Try environment variable first
    if let Ok(url) = std::env::var("HOTM_API_URL") {
        return url;
    }
    
    // Try to discover local servers
    if let Some(url) = discover_local_server() {
        return url;
    }
    
    // Fallback to default
    "http://127.0.0.1:53211".to_string()
}

#[cfg(feature = "desktop")]
fn discover_local_server() -> Option<String> {
    // Common ports and addresses to check for HotM servers
    let candidates = [
        "http://127.0.0.1:53211",
        "http://localhost:53211",
        "http://127.0.0.1:3000",
        "http://localhost:3000",
    ];
    
    for candidate in &candidates {
        if check_server_health_sync(candidate) {
            return Some(candidate.to_string());
        }
    }
    
    None
}

#[cfg(feature = "desktop")]
fn check_server_health_sync(url: &str) -> bool {
    let health_url = format!("{}/health", url);
    
    // Use a simple blocking reqwest client for consistency
    let client = match reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_millis(500))
        .build() 
    {
        Ok(client) => client,
        Err(_) => return false,
    };
    
    let response = match client.get(&health_url).send() {
        Ok(response) => response,
        Err(_) => return false,
    };
    
    if response.status().is_success() {
        if let Ok(health_text) = response.text() {
            // Try to parse as JSON and check if it's a HotM server
            if let Ok(health_json) = serde_json::from_str::<serde_json::Value>(&health_text) {
                if let Some(status) = health_json.get("status") {
                    return status.as_str() == Some("healthy") || status.as_str() == Some("degraded");
                }
            }
        }
    }
    
    false
}

#[cfg(feature = "desktop")]
async fn ensure_server_connection() -> Result<String, String> {
    let api_url = get_api_url();
    
    // Verify the server is actually accessible
    match get_server_health().await {
        Ok(_) => Ok(api_url),
        Err(e) => {
            // Try to discover an alternative server
            if let Some(discovered_url) = discover_local_server() {
                std::env::set_var("HOTM_API_URL", &discovered_url);
                Ok(discovered_url)
            } else {
                Err(format!("No accessible HotM server found. Original error: {}", e))
            }
        }
    }
}

// Tauri commands for desktop mode
#[cfg(feature = "desktop")]
#[tauri::command]
async fn get_server_health() -> Result<serde_json::Value, String> {
    let api_url = get_api_url();
    let url = format!("{}/health", api_url);
    
    reqwest::get(&url)
        .await
        .map_err(|e| format!("Failed to connect to server: {}", e))?
        .json::<serde_json::Value>()
        .await
        .map_err(|e| format!("Failed to parse server response: {}", e))
}

#[cfg(feature = "desktop")]
#[tauri::command]
async fn discover_servers() -> Result<Vec<String>, String> {
    let candidates = [
        "http://127.0.0.1:53211",
        "http://localhost:53211",
        "http://127.0.0.1:3000",
        "http://localhost:3000",
    ];
    
    let mut available_servers = Vec::new();
    
    for candidate in &candidates {
        if check_server_health_sync(candidate) {
            available_servers.push(candidate.to_string());
        }
    }
    
    if available_servers.is_empty() {
        Err("No HotM servers discovered".to_string())
    } else {
        Ok(available_servers)
    }
}

#[cfg(feature = "desktop")]
#[tauri::command]
async fn ensure_server_connection_command() -> Result<String, String> {
    ensure_server_connection().await
}

#[cfg(feature = "desktop")]
#[tauri::command]
async fn create_note_command(request: hotm_core::CreateNoteRequest) -> Result<hotm_core::NoteFull, String> {
    let api_url = get_api_url();
    let url = format!("{}/api/v1/notes", api_url);
    
    let client = reqwest::Client::new();
    client
        .post(&url)
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("Failed to create note: {}", e))?
        .json::<hotm_core::NoteFull>()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))
}

#[cfg(feature = "desktop")]
#[tauri::command]
async fn get_note_command(id: String) -> Result<hotm_core::NoteFull, String> {
    let api_url = get_api_url();
    let url = format!("{}/api/v1/notes/{}", api_url, id);
    
    reqwest::get(&url)
        .await
        .map_err(|e| format!("Failed to get note: {}", e))?
        .json::<hotm_core::NoteFull>()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))
}

#[cfg(feature = "desktop")]
#[tauri::command]
async fn update_note_command(id: String, request: hotm_core::PutRevisedRequest) -> Result<hotm_core::NoteFull, String> {
    let api_url = get_api_url();
    let url = format!("{}/api/v1/notes/{}/revised", api_url, id);
    
    let client = reqwest::Client::new();
    client
        .put(&url)
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("Failed to update note: {}", e))?
        .json::<hotm_core::NoteFull>()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))
}

#[cfg(feature = "desktop")]
#[tauri::command]
async fn delete_note_command(id: String) -> Result<(), String> {
    let api_url = get_api_url();
    let url = format!("{}/api/v1/notes/{}", api_url, id);
    
    let client = reqwest::Client::new();
    let response = client
        .delete(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to delete note: {}", e))?;
        
    if response.status().is_success() {
        Ok(())
    } else {
        Err(format!("Failed to delete note: {}", response.status()))
    }
}

#[cfg(feature = "desktop")]
#[tauri::command]
async fn search_notes_command(query: String, limit: Option<i32>) -> Result<hotm_core::SearchResponse, String> {
    let api_url = get_api_url();
    let url = format!("{}/api/v1/search?q={}&limit={}", api_url, 
                     urlencoding::encode(&query), 
                     limit.unwrap_or(20));
    
    reqwest::get(&url)
        .await
        .map_err(|e| format!("Failed to search notes: {}", e))?
        .json::<hotm_core::SearchResponse>()
        .await
        .map_err(|e| format!("Failed to parse search response: {}", e))
}

#[cfg(feature = "desktop")]
#[tauri::command]
async fn semantic_search_command(query: String, limit: Option<i32>) -> Result<hotm_core::SearchResponse, String> {
    let api_url = get_api_url();
    let url = format!("{}/api/v1/semantic", api_url);
    
    let client = reqwest::Client::new();
    let request_body = serde_json::json!({
        "query": query,
        "limit": limit.unwrap_or(20)
    });
    
    client
        .post(&url)
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Failed to perform semantic search: {}", e))?
        .json::<hotm_core::SearchResponse>()
        .await
        .map_err(|e| format!("Failed to parse search response: {}", e))
}

#[cfg(feature = "desktop")]
#[tauri::command]
async fn get_note_provenance_command(id: String) -> Result<serde_json::Value, String> {
    let api_url = get_api_url();
    let url = format!("{}/api/v1/notes/{}/provenance", api_url, id);
    
    reqwest::get(&url)
        .await
        .map_err(|e| format!("Failed to get note provenance: {}", e))?
        .json::<serde_json::Value>()
        .await
        .map_err(|e| format!("Failed to parse provenance response: {}", e))
}

#[cfg(feature = "desktop")]
#[tauri::command]
async fn set_note_tags_command(id: String, tags: Vec<String>) -> Result<(), String> {
    let api_url = get_api_url();
    let url = format!("{}/api/v1/notes/{}/tags", api_url, id);
    
    let client = reqwest::Client::new();
    client
        .put(&url)
        .json(&tags)
        .send()
        .await
        .map_err(|e| format!("Failed to set note tags: {}", e))?;
        
    Ok(())
}

#[cfg(feature = "desktop")]
#[tauri::command]
async fn set_note_collection_command(id: String, collection: String) -> Result<(), String> {
    let api_url = get_api_url();
    let url = format!("{}/api/v1/notes/{}/collection", api_url, id);
    
    let client = reqwest::Client::new();
    client
        .put(&url)
        .json(&collection)
        .send()
        .await
        .map_err(|e| format!("Failed to set note collection: {}", e))?;
        
    Ok(())
}

// PlantUML rendering commands
#[cfg(feature = "desktop")]
#[tauri::command]
async fn render_plantuml(_app: tauri::AppHandle, code: String) -> Result<String, String> {
    // Simple implementation - in full version this would use PlantUML service
    // For now, just return a placeholder SVG
    Ok(format!(r#"data:image/svg+xml;charset=utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" viewBox="0 0 200 100">
        <rect width="200" height="100" fill="lightgray" stroke="black"/>
        <text x="100" y="50" text-anchor="middle" dominant-baseline="middle">PlantUML: {}</text>
    </svg>"#, code.chars().take(10).collect::<String>()))
}

#[cfg(feature = "desktop")]
#[tauri::command]
async fn ensure_plantuml(_app: tauri::AppHandle) -> Result<(), String> {
    // Placeholder implementation
    Ok(())
}