// Minimal version for testing - no tray, just a window
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    println!("HotM Minimal: Starting...");
    
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|_app| {
            println!("HotM Minimal: Setup complete");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}