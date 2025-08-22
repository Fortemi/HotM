use tauri::{
    tray::{TrayIconBuilder}, 
    Manager, WindowEvent,
};
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri_plugin_global_shortcut::GlobalShortcutExt;

// Create a Hall of the Mind brain icon programmatically (purple gradient with brain shape)
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
            
            // Draw simplified brain shape
            let cx = SIZE as f32 / 2.0;
            let cy = SIZE as f32 / 2.0;
            let fx = x as f32;
            let fy = y as f32;
            
            // Left hemisphere (ellipse)
            let left_dist = ((fx - (cx - 3.0)).powi(2) / 49.0 + (fy - cy).powi(2) / 81.0).sqrt();
            let is_left_hemisphere = left_dist <= 1.0 && fx <= cx;
            
            // Right hemisphere (ellipse)
            let right_dist = ((fx - (cx + 3.0)).powi(2) / 49.0 + (fy - cy).powi(2) / 81.0).sqrt();
            let is_right_hemisphere = right_dist <= 1.0 && fx >= cx;
            
            // Central division line
            let is_division = fx >= cx - 0.5 && fx <= cx + 0.5 && fy >= cy - 8.0 && fy <= cy + 6.0;
            
            // Brain folds (simplified wavy lines)
            let fold1 = (fx >= cx - 6.0 && fx <= cx - 4.0 && fy >= cy - 3.0 && fy <= cy + 3.0) ||
                       (fx >= cx + 4.0 && fx <= cx + 6.0 && fy >= cy - 3.0 && fy <= cy + 3.0);
            
            if is_left_hemisphere || is_right_hemisphere || is_division || fold1 {
                // White for the brain shape
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
    
    // Build the global shortcut plugin with handler
    println!("HotM: Setting up global hotkey handler");
    
    let shortcut_plugin = tauri_plugin_global_shortcut::Builder::new()
        .with_handler(move |app, _shortcut, event| {
            // Handle hotkey events
            if event.state == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                println!("HotM: Hotkey pressed - toggling window");
                
                if let Some(window) = app.get_webview_window("main") {
                    if window.is_visible().unwrap_or(false) {
                        println!("HotM: Hiding window");
                        let _ = window.hide();
                    } else {
                        println!("HotM: Showing window");
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            }
        })
        .build();
    
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(shortcut_plugin)
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
            
            // Register the global hotkey
            match app.global_shortcut().register("CommandOrControl+Alt+H") {
                Ok(_) => println!("HotM: Global hotkey (Ctrl+Alt+H) registered successfully"),
                Err(e) => println!("HotM: Failed to register hotkey: {}", e),
            }
            
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