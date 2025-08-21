use tauri::{
    AppHandle, CustomMenuItem, Manager, SystemTray, SystemTrayEvent, SystemTrayMenu,
    SystemTrayMenuItem, WindowEvent,
};
use tauri_plugin_global_shortcut::GlobalShortcutExt;

#[tauri::command]
fn show_main_window(app: AppHandle) {
    if let Some(window) = app.get_window("main") {
        window.show().unwrap();
        window.set_focus().unwrap();
    }
}

#[tauri::command]
fn hide_main_window(app: AppHandle) {
    if let Some(window) = app.get_window("main") {
        window.hide().unwrap();
    }
}

fn create_tray_menu() -> SystemTrayMenu {
    let show = CustomMenuItem::new("show".to_string(), "Show HotM");
    let hide = CustomMenuItem::new("hide".to_string(), "Hide");
    let new_note = CustomMenuItem::new("new_note".to_string(), "New Note (Ctrl+Alt+H)");
    let quit = CustomMenuItem::new("quit".to_string(), "Quit");

    SystemTrayMenu::new()
        .add_item(show)
        .add_item(hide)
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(new_note)
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(quit)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let tray_menu = create_tray_menu();
    let system_tray = SystemTray::new().with_menu(tray_menu);

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .system_tray(system_tray)
        .on_system_tray_event(|app, event| match event {
            SystemTrayEvent::LeftClick { .. } => {
                if let Some(window) = app.get_window("main") {
                    if window.is_visible().unwrap() {
                        window.hide().unwrap();
                    } else {
                        window.show().unwrap();
                        window.set_focus().unwrap();
                    }
                }
            }
            SystemTrayEvent::MenuItemClick { id, .. } => match id.as_str() {
                "show" => {
                    if let Some(window) = app.get_window("main") {
                        window.show().unwrap();
                        window.set_focus().unwrap();
                    }
                }
                "hide" => {
                    if let Some(window) = app.get_window("main") {
                        window.hide().unwrap();
                    }
                }
                "new_note" => {
                    if let Some(window) = app.get_window("main") {
                        window.show().unwrap();
                        window.set_focus().unwrap();
                        // Emit event to frontend to focus new note input
                        window.emit("focus-new-note", ()).unwrap();
                    }
                }
                "quit" => {
                    std::process::exit(0);
                }
                _ => {}
            },
            _ => {}
        })
        .on_window_event(|event| match event.event() {
            WindowEvent::CloseRequested { api, .. } => {
                // Instead of closing, hide the window
                event.window().hide().unwrap();
                api.prevent_close();
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![show_main_window, hide_main_window])
        .setup(|app| {
            // Register global hotkey Ctrl+Alt+H
            let app_handle = app.handle();
            let window = app.get_window("main").unwrap();
            
            // Clone for the closure
            let window_clone = window.clone();
            
            app_handle.global_shortcut().register("Ctrl+Alt+H", move || {
                if window_clone.is_visible().unwrap() {
                    window_clone.hide().unwrap();
                } else {
                    window_clone.show().unwrap();
                    window_clone.set_focus().unwrap();
                    window_clone.emit("focus-new-note", ()).unwrap();
                }
            }).unwrap();

            // Start with window hidden (tray only)
            window.hide().unwrap();

            // Show notification that app is running
            #[cfg(target_os = "windows")]
            {
                use tauri_plugin_notification::NotificationExt;
                app.notification()
                    .builder()
                    .title("HotM")
                    .body("HotM is running in the system tray. Press Ctrl+Alt+H to open.")
                    .show()
                    .unwrap();
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}