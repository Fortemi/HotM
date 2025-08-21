use tauri::{
    tray::{TrayIconBuilder, TrayIconEvent}, 
    Manager, WindowEvent, Emitter,
};
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .on_window_event(|window, event| match event {
            WindowEvent::CloseRequested { api, .. } => {
                // Instead of closing, hide the window
                window.hide().unwrap();
                api.prevent_close();
            }
            _ => {}
        })
        .setup(|app| {
            let handle = app.handle().clone();
            
            // Create tray menu
            let show = MenuItemBuilder::with_id("show", "Show HotM").build(app)?;
            let hide = MenuItemBuilder::with_id("hide", "Hide").build(app)?;
            let new_note = MenuItemBuilder::with_id("new_note", "New Note (Ctrl+Alt+H)").build(app)?;
            let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;
            
            let menu = MenuBuilder::new(app)
                .items(&[&show, &hide, &new_note, &quit])
                .build()?;
            
            // Create system tray
            let _ = TrayIconBuilder::new()
                .menu(&menu)
                .tooltip("HotM - Notes & Analysis")
                .on_tray_icon_event(move |tray, event| {
                    match event {
                        TrayIconEvent::Click {
                            button: tauri::tray::MouseButton::Left,
                            button_state: tauri::tray::MouseButtonState::Up,
                            ..
                        } => {
                            let app = tray.app_handle();
                            if let Some(window) = app.get_webview_window("main") {
                                if window.is_visible().unwrap_or(false) {
                                    let _ = window.hide();
                                } else {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                            }
                        }
                        _ => {}
                    }
                })
                .on_menu_event(move |app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "hide" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.hide();
                        }
                    }
                    "new_note" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                            let _ = window.emit("focus-new-note", ());
                        }
                    }
                    "quit" => {
                        std::process::exit(0);
                    }
                    _ => {}
                })
                .build(app)?;
            
            // Register global hotkey Ctrl+Alt+H
            let window = app.get_webview_window("main").unwrap();
            
            // Register the shortcut
            handle.global_shortcut().register("Ctrl+Alt+H")?;
            
            // Set up listener for the shortcut
            let window_clone = window.clone();
            handle.global_shortcut().on_shortcut("Ctrl+Alt+H", move |_app, _shortcut, event| {
                if event.state == ShortcutState::Pressed {
                    if window_clone.is_visible().unwrap_or(false) {
                        let _ = window_clone.hide();
                    } else {
                        let _ = window_clone.show();
                        let _ = window_clone.set_focus();
                        let _ = window_clone.emit("focus-new-note", ());
                    }
                }
            })?;

            // Start with window hidden (tray only)
            window.hide()?;

            // Show notification that app is running (Windows only)
            #[cfg(target_os = "windows")]
            {
                use tauri_plugin_notification::NotificationExt;
                app.notification()
                    .builder()
                    .title("HotM")
                    .body("HotM is running in the system tray. Press Ctrl+Alt+H to open.")
                    .show()?;
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}