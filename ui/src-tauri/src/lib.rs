use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::TrayIconBuilder;
use tauri::{Manager, WindowEvent};
use tauri_plugin_global_shortcut::GlobalShortcutExt;

mod config;
mod plantuml;

#[tauri::command]
async fn render_plantuml(app: tauri::AppHandle, code: String) -> Result<String, String> {
    plantuml::render_plantuml(&app, &code).map_err(|e| e.to_string())
}

#[tauri::command]
async fn ensure_plantuml(app: tauri::AppHandle) -> Result<(), String> {
    plantuml::ensure_plantuml_jar(&app)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_app_config(app: tauri::AppHandle) -> config::AppConfig {
    config::load_config(&app)
}

#[tauri::command]
fn save_app_config(app: tauri::AppHandle, config: config::AppConfig) -> Result<(), String> {
    config::save_config(&app, &config)
}

/// Create a fallback icon programmatically (purple gradient with brain shape)
fn create_default_icon() -> tauri::image::Image<'static> {
    const SIZE: u32 = 32;
    let mut pixels = Vec::with_capacity((SIZE * SIZE * 4) as usize);

    for y in 0..SIZE {
        for x in 0..SIZE {
            let diagonal_gradient = ((x + y) as f32 / (SIZE * 2) as f32 * 80.0) as u8;
            let r = 76 + diagonal_gradient;
            let g = 41 + diagonal_gradient;
            let b = 145 + diagonal_gradient;

            let cx = SIZE as f32 / 2.0;
            let cy = SIZE as f32 / 2.0;
            let fx = x as f32;
            let fy = y as f32;

            let left_dist =
                ((fx - (cx - 3.0)).powi(2) / 49.0 + (fy - cy).powi(2) / 81.0).sqrt();
            let is_left_hemisphere = left_dist <= 1.0 && fx <= cx;

            let right_dist =
                ((fx - (cx + 3.0)).powi(2) / 49.0 + (fy - cy).powi(2) / 81.0).sqrt();
            let is_right_hemisphere = right_dist <= 1.0 && fx >= cx;

            let is_division =
                fx >= cx - 0.5 && fx <= cx + 0.5 && fy >= cy - 8.0 && fy <= cy + 6.0;

            let fold1 = (fx >= cx - 6.0
                && fx <= cx - 4.0
                && fy >= cy - 3.0
                && fy <= cy + 3.0)
                || (fx >= cx + 4.0
                    && fx <= cx + 6.0
                    && fy >= cy - 3.0
                    && fy <= cy + 3.0);

            if is_left_hemisphere || is_right_hemisphere || is_division || fold1 {
                pixels.extend_from_slice(&[255, 255, 255, 255]);
            } else {
                pixels.extend_from_slice(&[r, g, b, 255]);
            }
        }
    }

    tauri::image::Image::new_owned(pixels, SIZE, SIZE)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let args: Vec<String> = std::env::args().collect();
    let start_minimized = args.contains(&"--minimized".to_string())
        || args.contains(&"/minimized".to_string());

    let shortcut_plugin = tauri_plugin_global_shortcut::Builder::new()
        .with_handler(move |app, _shortcut, event| {
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

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(shortcut_plugin)
        .invoke_handler(tauri::generate_handler![render_plantuml, ensure_plantuml, get_app_config, save_app_config])
        .setup(move |app| {
            // Register global shortcut: Ctrl+Alt+H
            app.global_shortcut()
                .register("CmdOrCtrl+Alt+H")
                .unwrap_or_else(|e| {
                    eprintln!("HotM: Failed to register global shortcut: {}", e);
                });

            // Build tray menu
            let show = MenuItemBuilder::with_id("show", "Show").build(app)?;
            let hide = MenuItemBuilder::with_id("hide", "Hide").build(app)?;
            let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;

            let menu = MenuBuilder::new(app)
                .item(&show)
                .item(&hide)
                .separator()
                .item(&quit)
                .build()?;

            // Try to load bundled icon, fall back to programmatic icon
            let icon = app
                .default_window_icon()
                .cloned()
                .unwrap_or_else(|| create_default_icon());

            TrayIconBuilder::new()
                .icon(icon)
                .tooltip("HotM - Hall of the Mind")
                .menu(&menu)
                .on_menu_event(|app, event| match event.id().as_ref() {
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
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::Click { .. } = event {
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
                })
                .build(app)?;

            // Handle --minimized flag
            if start_minimized {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            // Close to tray instead of quitting
            if let WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running HotM");
}
