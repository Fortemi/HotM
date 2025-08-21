use tauri::{
    tray::{TrayIconBuilder}, 
    Manager, WindowEvent,
};
use tauri::menu::{MenuBuilder, MenuItemBuilder};

// Create a Hall of the Mind icon programmatically (purple gradient with "HM" monogram)
fn create_default_icon() -> tauri::image::Image<'static> {
    const SIZE: u32 = 32;
    let mut pixels = Vec::with_capacity((SIZE * SIZE * 4) as usize);
    
    for y in 0..SIZE {
        for x in 0..SIZE {
            // Create a purple-to-indigo gradient background
            let diagonal_gradient = ((x + y) as f32 / (SIZE * 2) as f32 * 80.0) as u8;
            let r = 76 + diagonal_gradient;  // Deep purple to lighter
            let g = 41 + diagonal_gradient;
            let b = 145 + diagonal_gradient;
            
            // Draw "HM" monogram for Hall of the Mind
            // H on the left
            let is_h = (x >= 5 && x <= 7 && y >= 8 && y <= 24) ||   // H left vertical
                      (x >= 11 && x <= 13 && y >= 8 && y <= 24) ||  // H right vertical
                      (x >= 5 && x <= 13 && y >= 15 && y <= 17);    // H horizontal
            
            // M on the right
            let is_m = (x >= 16 && x <= 18 && y >= 8 && y <= 24) ||  // M left vertical
                      (x >= 19 && x <= 20 && y >= 10 && y <= 16) ||  // M middle valley
                      (x >= 21 && x <= 22 && y >= 10 && y <= 16) ||  // M middle peak
                      (x >= 24 && x <= 26 && y >= 8 && y <= 24);     // M right vertical
            
            if is_h || is_m {
                // White for the letters
                pixels.extend_from_slice(&[255, 255, 255, 255]);
            } else {
                // Purple gradient for background
                pixels.extend_from_slice(&[r, g, b, 255]);
            }
        }
    }
    
    tauri::image::Image::new_owned(pixels, SIZE, SIZE)
}


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Check for command line arguments
    let args: Vec<String> = std::env::args().collect();
    let start_minimized = args.contains(&"--minimized".to_string()) || 
                         args.contains(&"/minimized".to_string());
    
    println!("HotM: Starting Tauri application...");
    if start_minimized {
        println!("HotM: Starting in minimized mode");
    }
    
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
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
        .setup(move |app| {
            println!("HotM: Running setup...");
            
            // Register global hotkey (Ctrl+Alt+H) - will toggle on key press (not hold)
            println!("HotM: Setting up global hotkey (Ctrl+Alt+H)...");
            
            // For now, we'll rely on tray menu for toggle until we fix the hotkey API usage
            // The hotkey plugin API has changed and needs proper implementation
            
            // Create tray menu
            println!("HotM: Creating menu items...");
            let show = MenuItemBuilder::with_id("show", "Show Hall of the Mind").build(app)?;
            let hide = MenuItemBuilder::with_id("hide", "Hide").build(app)?;
            let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;
            
            println!("HotM: Building menu...");
            let menu = MenuBuilder::new(app)
                .items(&[&show, &hide, &quit])
                .build()?;
            
            // Clone app handle for menu events
            let app_handle = app.handle().clone();
            
            println!("HotM: Creating tray icon...");
            
            // For now, use the programmatically generated icon
            // In production, the icon files will be bundled with the app
            println!("HotM: Creating default icon...");
            let icon = create_default_icon();
            
            // Create system tray
            let _tray = TrayIconBuilder::new()
                .icon(icon)
                .menu(&menu)
                .tooltip("Hall of the Mind")
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
            
            // If started with --minimized, hide the window
            if start_minimized {
                if let Some(window) = app.get_webview_window("main") {
                    println!("HotM: Hiding window for minimized start");
                    let _ = window.hide();
                }
            }
            
            println!("HotM: Setup complete!");
            println!("HotM: Press Ctrl+Alt+H to show/hide the window");
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}