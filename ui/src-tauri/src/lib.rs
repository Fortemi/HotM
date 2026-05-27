use std::collections::HashMap;
use std::net::TcpListener;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::TrayIconBuilder;
use tauri::{Emitter, Manager, WindowEvent};
use tauri_plugin_global_shortcut::GlobalShortcutExt;
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::ShellExt;

use base64::{engine::general_purpose::STANDARD as B64, Engine};

mod config;
mod plantuml;

static SSE_COUNTER: AtomicU64 = AtomicU64::new(1);

/// Initialization script injected into every webview before any page JS runs.
///
/// Installs window.__HOTM_HOST__ with Rust-backed fetch and SSE so all API
/// calls route through reqwest in the host process rather than WebKit2GTK's
/// network stack (which blocks loopback HTTP on Linux).
///
/// The guard `if(!window.__HOTM_HOST__)` means embedding hosts
/// that inject their own adapter first keep theirs — HotM never overwrites it.
/// This script is a no-op in Docker/web mode because Tauri never injects it.
const HOTM_HOST_INIT: &str = concat!(
    "if(!window.__HOTM_HOST__){",
    "window.__HOTM_HOST__={network:{",
    "fetch:function(a){return window.__TAURI_INTERNALS__.invoke('hotm_fetch',a);},",
    "sse:{",
    "connect:function(a){return window.__TAURI_INTERNALS__.invoke('hotm_sse_connect',a);},",
    "close:function(a){return window.__TAURI_INTERNALS__.invoke('hotm_sse_close',a);}",
    "}}};",
    "}"
);

/// Proxy an HTTP request through reqwest in the host process.
///
/// This bypasses WebKit2GTK's network stack entirely, which on Linux
/// blocks requests to loopback addresses made via @tauri-apps/plugin-http.
/// All four deployment modes converge here:
///   - Standalone Tauri (Linux/macOS): initializationScript installs
///     window.__HOTM_HOST__ pointing at this command.
///   - Embedding shell: the host injects its own window.__HOTM_HOST__
///     before HotM loads; initializationScript's guard skips this command.
///   - Docker/web: no Tauri, no initializationScript; native fetch is used.
///   - Dev browser: same as Docker/web.
///
/// Note on `rename_all = "snake_case"`: Tauri v2's default is to rename
/// command argument keys from snake_case (Rust) to camelCase (JS). The
/// `__HOTM_HOST__` adapter contract (see HotmHostAdapter in
/// ui/src/lib/tauri.ts) and the manual JSON return value below both use
/// snake_case (`body_b64`). Without this attribute, the JS-side
/// `body_b64` key is silently dropped during deserialization, so every
/// POST/PUT/PATCH body arrives as None and reqwest sends an empty body
/// to the backend — producing 400 errors on Admin Panel "Test Connection",
/// note creation, etc. Keeping the whole stack in snake_case is simpler
/// than splitting conventions.
#[tauri::command(rename_all = "snake_case")]
async fn hotm_fetch(
    url: String,
    method: Option<String>,
    headers: Option<HashMap<String, String>>,
    body_b64: Option<String>,
) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;

    let method_str = method.as_deref().unwrap_or("GET");
    let method = reqwest::Method::from_bytes(method_str.as_bytes())
        .map_err(|e| e.to_string())?;

    let mut req = client.request(method, &url);

    if let Some(hdrs) = headers {
        for (k, v) in hdrs {
            req = req.header(k, v);
        }
    }

    if let Some(b64) = body_b64 {
        if !b64.is_empty() {
            let body = B64.decode(&b64).map_err(|e| e.to_string())?;
            req = req.body(body);
        }
    }

    let resp = req.send().await.map_err(|e| e.to_string())?;
    let status = resp.status().as_u16();
    let status_text = resp
        .status()
        .canonical_reason()
        .unwrap_or("")
        .to_string();

    let mut resp_headers = serde_json::Map::new();
    for (k, v) in resp.headers() {
        if let Ok(vs) = v.to_str() {
            resp_headers.insert(k.as_str().to_string(), serde_json::Value::String(vs.to_string()));
        }
    }

    let body = resp.bytes().await.map_err(|e| e.to_string())?;
    let body_b64 = B64.encode(&body);

    Ok(serde_json::json!({
        "status": status,
        "status_text": status_text,
        "headers": resp_headers,
        "body_b64": body_b64
    }))
}

/// Open an SSE connection through reqwest and forward events to the webview
/// via window.postMessage, matching the __HOTM_HOST__ contract expected by
/// tauri.ts / events.ts.
#[tauri::command]
async fn hotm_sse_connect(app: tauri::AppHandle, url: String) -> Result<serde_json::Value, String> {
    let handle = format!("sse-{}", SSE_COUNTER.fetch_add(1, Ordering::SeqCst));
    let handle_clone = handle.clone();

    tauri::async_runtime::spawn(async move {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(3600))
            .build()
            .unwrap_or_default();

        let result = client
            .get(&url)
            .header("Accept", "text/event-stream")
            .header("Cache-Control", "no-cache")
            .send()
            .await;

        match result {
            Err(e) => {
                let _ = post_sse_event(&app, &handle_clone, "__error", Some(&e.to_string()), None);
            }
            Ok(resp) => {
                use futures_util::StreamExt;
                let mut stream = resp.bytes_stream();
                let mut buf = String::new();
                let mut ev_type = String::new();
                let mut ev_data = String::new();
                let mut ev_id = String::new();

                while let Some(chunk) = stream.next().await {
                    let bytes = match chunk {
                        Ok(b) => b,
                        Err(_) => break,
                    };
                    buf.push_str(&String::from_utf8_lossy(&bytes));

                    while let Some(pos) = buf.find('\n') {
                        let line = buf[..pos].trim_end_matches('\r').to_string();
                        buf.drain(..=pos);

                        if line.is_empty() {
                            if !ev_data.is_empty() {
                                let t = if ev_type.is_empty() { "message" } else { &ev_type };
                                let id = if ev_id.is_empty() { None } else { Some(ev_id.as_str()) };
                                let _ = post_sse_event(&app, &handle_clone, t, Some(&ev_data), id);
                            }
                            ev_type.clear();
                            ev_data.clear();
                            ev_id.clear();
                        } else if let Some(v) = line.strip_prefix("event:") {
                            ev_type = v.trim_start().to_string();
                        } else if let Some(v) = line.strip_prefix("data:") {
                            if !ev_data.is_empty() {
                                ev_data.push('\n');
                            }
                            ev_data.push_str(v.trim_start());
                        } else if let Some(v) = line.strip_prefix("id:") {
                            ev_id = v.trim_start().to_string();
                        }
                    }
                }
                let _ = post_sse_event(&app, &handle_clone, "__close", None, None);
            }
        }
    });

    Ok(serde_json::json!({ "handle": handle, "event": "network.sse" }))
}

/// No-op for now; the SSE stream closes naturally when the server disconnects
/// or when the app exits. Full cancellation can be added later via a handle map.
#[tauri::command]
async fn hotm_sse_close(_handle: String) -> Result<(), String> {
    Ok(())
}

/// Deliver an SSE event to the webview by executing window.postMessage.
/// The payload shape matches what tauri.ts / events.ts expect from the
/// __HOTM_HOST__ adapter contract.
fn post_sse_event(
    app: &tauri::AppHandle,
    handle: &str,
    event_type: &str,
    data: Option<&str>,
    id: Option<&str>,
) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "main window not found".to_string())?;

    let payload = serde_json::json!({
        "type": event_type,
        "data": data,
        "id": id
    });

    let msg = serde_json::json!({
        "__hotm_host_event": true,
        "event": "network.sse",
        "handle": handle,
        "payload": payload
    });

    let js = format!(
        "window.postMessage({}, '*')",
        serde_json::to_string(&msg).map_err(|e| e.to_string())?
    );

    window.eval(&js).map_err(|e| e.to_string())
}

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
    plantuml::render_plantuml(&app, &code).await.map_err(|e| e.to_string())
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
        .invoke_handler(tauri::generate_handler![
            render_plantuml,
            ensure_plantuml,
            get_app_config, save_app_config,
            hotm_fetch,
            hotm_sse_connect,
            hotm_sse_close,
        ])
        .setup(move |app| {
            // ── Main window (created programmatically so we can inject the
            //    host-proxy init script before any page JS executes) ────────
            tauri::WebviewWindowBuilder::new(
                app,
                "main",
                tauri::WebviewUrl::App("index.html".into()),
            )
            .title("Hall of the Mind")
            .inner_size(1200.0, 800.0)
            .center()
            .decorations(true)
            .resizable(true)
            .initialization_script(HOTM_HOST_INIT)
            .build()?;

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
                    let api_url = format!("http://127.0.0.1:{}/api/v1", port);

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
                        .sidecar("hotm-matric-api")
                        .map_err(|e| format!("sidecar not found: {e}"))?
                        .env("DATABASE_URL", &cfg.database_url)
                        .env("HOST", "127.0.0.1")
                        .env("PORT", port.to_string())
                        .env("FILE_STORAGE_PATH", &file_storage)
                        // The bundled desktop sidecar is private to localhost and the
                        // webview host adapter. Fortemi now defaults to fail-closed
                        // auth, so explicitly opt this embedded mode into anonymous
                        // local access until HotM bootstraps OAuth tokens.
                        .env("REQUIRE_AUTH", "false")
                        .env("I_UNDERSTAND_NO_AUTH", "true")
                        .env("RATE_LIMIT_ENABLED", "false")
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
