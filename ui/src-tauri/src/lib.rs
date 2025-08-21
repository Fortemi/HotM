use tauri::{
    tray::{TrayIconBuilder}, 
    Manager, WindowEvent,
};
use tauri::menu::{MenuBuilder, MenuItemBuilder};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Enable console output for debugging in release builds
    #[cfg(windows)]
    {
        use std::io::Write;
        let _ = std::fs::create_dir_all("C:\\temp");
        let log_file = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open("C:\\temp\\hotm_startup.log");
        
        if let Ok(mut file) = log_file {
            let _ = writeln!(file, "HotM starting at: {:?}", std::time::SystemTime::now());
        }
    }
    
    println!("HotM: Starting Tauri application...");
    
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .on_window_event(|window, event| {
            println!("HotM: Window event: {:?}", event);
            match event {
                WindowEvent::CloseRequested { api, .. } => {
                    // Instead of closing, hide the window to tray
                    println!("HotM: Close requested, hiding to tray");
                    let _ = window.hide();
                    api.prevent_close();
                }
                _ => {}
            }
        })
        .setup(|app| {
            println!("HotM: Running setup...");
            // Log to file on Windows
            #[cfg(windows)]
            {
                use std::io::Write;
                if let Ok(mut file) = std::fs::OpenOptions::new()
                    .create(true)
                    .append(true)
                    .open("C:\\temp\\hotm_startup.log") 
                {
                    let _ = writeln!(file, "Creating tray menu...");
                }
            }
            
            // Create tray menu
            println!("HotM: Creating menu items...");
            let show = MenuItemBuilder::with_id("show", "Show HotM").build(app)?;
            let hide = MenuItemBuilder::with_id("hide", "Hide").build(app)?;
            let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;
            
            println!("HotM: Building menu...");
            let menu = MenuBuilder::new(app)
                .items(&[&show, &hide, &quit])
                .build()?;
            
            // Clone app handle for menu events
            let app_handle = app.handle().clone();
            
            println!("HotM: Creating tray icon...");
            
            // Create system tray
            let _tray = TrayIconBuilder::new()
                .menu(&menu)
                .tooltip("HotM - Notes & Analysis")
                .on_menu_event(move |_app, event| {
                    println!("HotM: Tray menu event: {}", event.id.as_ref());
                    match event.id.as_ref() {
                        "show" => {
                            if let Some(window) = app_handle.get_webview_window("main") {
                                println!("HotM: Showing window");
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "hide" => {
                            if let Some(window) = app_handle.get_webview_window("main") {
                                println!("HotM: Hiding window");
                                let _ = window.hide();
                            }
                        }
                        "quit" => {
                            println!("HotM: Quitting application");
                            std::process::exit(0);
                        }
                        _ => {}
                    }
                })
                .build(app)?;
            
            println!("HotM: Setup complete!");
            
            #[cfg(windows)]
            {
                use std::io::Write;
                if let Ok(mut file) = std::fs::OpenOptions::new()
                    .create(true)
                    .append(true)
                    .open("C:\\temp\\hotm_startup.log") 
                {
                    let _ = writeln!(file, "Setup complete, app should be running");
                }
            }
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}