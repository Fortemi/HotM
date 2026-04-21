use std::net::TcpListener;
use std::sync::{Arc, Mutex};
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::TrayIconBuilder;
use tauri::{Emitter, Manager, WindowEvent};
use tauri_plugin_global_shortcut::GlobalShortcutExt;
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::ShellExt;

mod config;
mod plantuml;

/// Find a free TCP port by binding to port 0.
fn find_free_port() -> u16 {
    TcpListener::bind("127.0.0.1:0")
        .expect("failed to bind ephemeral port")
        .local_addr()
        .unwrap()
        .port()
}

type SidecarHandle = Arc<Mutex<Option<CommandChild>>>;

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

    let sidecar_handle: SidecarHandle = Arc::new(Mutex::new(None));
    let sidecar_handle_setup = sidecar_handle.clone();
    let sidecar_handle_exit = sidecar_handle.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_http::init())
        .plugin(shortcut_plugin)
        .invoke_handler(tauri::generate_handler![render_plantuml, ensure_plantuml, get_app_config, save_app_config])
        .setup(move |app| {
            // Register global shortcut: Ctrl+Alt+H
            app.global_shortcut()
                .register("CmdOrCtrl+Alt+H")
                .unwrap_or_else(|e| {
                    eprintln!("HotM: Failed to register global shortcut: {}", e);
                });

            // ── Fortemi sidecar ───────────────────────────────────────────
            {
                let cfg = config::load_config(app.handle());
                if !cfg.database_url.is_empty() {
                    let port = find_free_port();
                    let api_url = format!("http://127.0.0.1:{}", port);

                    // Resolve file storage path: config value OR <app_data>/fortemi-files
                    let file_storage = if cfg.file_storage_path.is_empty() {
                        app.handle()
                            .path()
                            .app_data_dir()
                            .map(|p| p.join("fortemi-files").to_string_lossy().to_string())
                            .unwrap_or_else(|_| "/tmp/hotm-fortemi-files".to_string())
                    } else {
                        cfg.file_storage_path.clone()
                    };

                    eprintln!("HotM: launching Fortemi sidecar on {} (storage: {})", api_url, file_storage);

                    let (rx, child) = app
                        .shell()
                        .sidecar("matric-api")
                        .map_err(|e| format!("sidecar not found: {e}"))?
                        .env("DATABASE_URL", &cfg.database_url)
                        .env("HOST", "127.0.0.1")
                        .env("PORT", port.to_string())
                        .env("FILE_STORAGE_PATH", &file_storage)
                        .spawn()
                        .map_err(|e| format!("failed to spawn sidecar: {e}"))?;

                    *sidecar_handle_setup.lock().unwrap() = Some(child);

                    // Forward sidecar stdout/stderr to host stderr for debugging
                    let handle = app.handle().clone();
                    let health_url = format!("http://127.0.0.1:{}/health", port);
                    tauri::async_runtime::spawn(async move {
                        use tauri_plugin_shell::process::CommandEvent;
                        let mut rx = rx;

                        // Drain stdout/stderr while concurrently polling the health endpoint.
                        // We poll in a separate spawned task so log forwarding never blocks.
                        let probe_handle = handle.clone();
                        let probe_url = health_url.clone();
                        tauri::async_runtime::spawn(async move {
                            let client = reqwest::Client::builder()
                                .timeout(std::time::Duration::from_secs(2))
                                .build()
                                .unwrap_or_default();
                            let deadline = std::time::Instant::now()
                                + std::time::Duration::from_secs(30);
                            loop {
                                if std::time::Instant::now() > deadline {
                                    eprintln!("HotM: sidecar did not become healthy within 30s");
                                    break;
                                }
                                tokio::time::sleep(std::time::Duration::from_millis(500)).await;
                                if let Ok(resp) = client.get(&probe_url).send().await {
                                    if resp.status().is_success() {
                                        eprintln!("HotM: sidecar ready");
                                        let _ = probe_handle.emit("sidecar:ready", ());
                                        break;
                                    }
                                }
                            }
                        });

                        while let Some(event) = rx.recv().await {
                            match event {
                                CommandEvent::Stdout(line) => {
                                    eprintln!("[fortemi] {}", String::from_utf8_lossy(&line));
                                }
                                CommandEvent::Stderr(line) => {
                                    eprintln!("[fortemi:err] {}", String::from_utf8_lossy(&line));
                                }
                                CommandEvent::Error(e) => {
                                    eprintln!("[fortemi:exit-error] {}", e);
                                }
                                CommandEvent::Terminated(status) => {
                                    eprintln!("[fortemi] process exited: {:?}", status);
                                    let _ = handle;
                                    break;
                                }
                                _ => {}
                            }
                        }
                    });

                    // Persist the resolved URL into config so the frontend reads it
                    let mut updated_cfg = cfg.clone();
                    updated_cfg.api_base_url = api_url;
                    let _ = config::save_config(app.handle(), &updated_cfg);
                }
            }

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
        .on_menu_event(move |_app, event| {
            if event.id().as_ref() == "quit" {
                // Kill sidecar before exit
                if let Ok(mut guard) = sidecar_handle_exit.lock() {
                    if let Some(child) = guard.take() {
                        let _ = child.kill();
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running HotM");
}
