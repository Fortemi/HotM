use serde::Serialize;
use std::collections::HashMap;
use std::io::{Read, Seek, SeekFrom, Write};
use std::net::TcpListener;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::TrayIconBuilder;
use tauri::{Emitter, Manager, WindowEvent};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_global_shortcut::GlobalShortcutExt;
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::ShellExt;

use base64::{engine::general_purpose::STANDARD as B64, Engine};
use futures_util::StreamExt;
use sha2::{Digest, Sha256};

mod config;
mod plantuml;

static SSE_COUNTER: AtomicU64 = AtomicU64::new(1);

#[derive(Debug, Serialize)]
struct LocalFileInfo {
    path: String,
    name: String,
    size: u64,
    content_type: String,
}

#[derive(Clone, Debug, Serialize)]
struct UploadProgress {
    upload_id: String,
    bytes_uploaded: u64,
    bytes_total: u64,
}

#[derive(Clone, Debug, Serialize)]
struct DownloadedFileInfo {
    path: String,
    bytes_written: u64,
    sha256: String,
    reopened: bool,
    reopened_bytes: u64,
}

#[tauri::command]
async fn hotm_pick_local_files(app: tauri::AppHandle) -> Result<Vec<LocalFileInfo>, String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "main window is unavailable".to_string())?;
    let selected = tauri::async_runtime::spawn_blocking(move || {
        window
            .dialog()
            .file()
            .set_title("Select Files")
            .blocking_pick_files()
    })
    .await
    .map_err(|e| e.to_string())?;

    let paths = selected
        .unwrap_or_default()
        .into_iter()
        .map(|path| path.into_path().map_err(|e| e.to_string()))
        .collect::<Result<Vec<_>, _>>()?;
    describe_local_files(paths)
}

fn describe_local_files(paths: Vec<std::path::PathBuf>) -> Result<Vec<LocalFileInfo>, String> {
    let mut files = Vec::new();
    for path in paths {
        let metadata =
            std::fs::metadata(&path).map_err(|e| format!("{}: {}", path.display(), e))?;
        if !metadata.is_file() {
            continue;
        }
        let raw = path.to_string_lossy().to_string();
        let name = path
            .file_name()
            .and_then(|v| v.to_str())
            .unwrap_or(&raw)
            .to_string();
        files.push(LocalFileInfo {
            path: raw,
            content_type: guess_content_type(&name).to_string(),
            name,
            size: metadata.len(),
        });
    }
    Ok(files)
}

#[tauri::command(rename_all = "snake_case")]
async fn hotm_upload_local_file(
    app: tauri::AppHandle,
    api_base_url: String,
    note_id: String,
    path: String,
    content_type: Option<String>,
    media_optimize: Option<bool>,
    headers: Option<HashMap<String, String>>,
    upload_id: Option<String>,
) -> Result<serde_json::Value, String> {
    upload_local_file_core(
        &api_base_url,
        &note_id,
        &path,
        content_type,
        media_optimize,
        headers,
        |bytes_uploaded, bytes_total| {
            emit_upload_progress(&app, &upload_id, bytes_uploaded, bytes_total);
        },
    )
    .await
}

#[tauri::command(rename_all = "snake_case")]
async fn hotm_download_attachment_to_file(
    app: tauri::AppHandle,
    api_base_url: String,
    attachment_id: String,
    destination_path: Option<String>,
    suggested_filename: Option<String>,
    variant: Option<String>,
    headers: Option<HashMap<String, String>>,
) -> Result<Option<DownloadedFileInfo>, String> {
    let destination_path = match destination_path {
        Some(path) if !path.trim().is_empty() => std::path::PathBuf::from(path),
        _ => match pick_attachment_save_path(app, suggested_filename).await? {
            Some(path) => path,
            None => return Ok(None),
        },
    };

    download_attachment_to_file_core(
        &api_base_url,
        &attachment_id,
        &destination_path,
        variant,
        headers,
    )
    .await
    .map(Some)
}

async fn pick_attachment_save_path(
    app: tauri::AppHandle,
    suggested_filename: Option<String>,
) -> Result<Option<std::path::PathBuf>, String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "main window is unavailable".to_string())?;
    let output = tauri::async_runtime::spawn_blocking(move || {
        let mut dialog = window.dialog().file().set_title("Save Attachment");
        if let Some(filename) = suggested_filename.filter(|v| !v.trim().is_empty()) {
            dialog = dialog.set_file_name(filename);
        }
        dialog.blocking_save_file()
    })
    .await
    .map_err(|e| e.to_string())?;

    match output {
        Some(path) => path.into_path().map(Some).map_err(|e| e.to_string()),
        None => Ok(None),
    }
}

async fn download_attachment_to_file_core(
    api_base_url: &str,
    attachment_id: &str,
    destination_path: &std::path::Path,
    variant: Option<String>,
    headers: Option<HashMap<String, String>>,
) -> Result<DownloadedFileInfo, String> {
    if attachment_id.trim().is_empty() {
        return Err("Attachment ID is required".to_string());
    }

    if let Some(parent) = destination_path.parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
    }

    let endpoint = format!(
        "{}/attachments/{}/download",
        api_base_url.trim_end_matches('/'),
        attachment_id
    );
    let mut endpoint = reqwest::Url::parse(&endpoint).map_err(|e| e.to_string())?;
    if let Some(variant) = variant.filter(|v| !v.trim().is_empty()) {
        endpoint.query_pairs_mut().append_pair("variant", &variant);
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(3600))
        .build()
        .map_err(|e| e.to_string())?;

    let mut req = client.get(endpoint);
    if let Some(hdrs) = &headers {
        for (k, v) in hdrs {
            req = req.header(k, v);
        }
    }

    let resp = req.send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!(
            "Attachment download failed: HTTP {} {}",
            status.as_u16(),
            body
        ));
    }

    let temp_path = destination_path.with_extension(format!(
        "{}hotm-download-tmp",
        destination_path
            .extension()
            .and_then(|v| v.to_str())
            .map(|v| format!("{v}."))
            .unwrap_or_default()
    ));
    let mut temp_file = std::fs::File::create(&temp_path).map_err(|e| e.to_string())?;
    let mut bytes_written = 0_u64;
    let mut stream = resp.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = match chunk {
            Ok(chunk) => chunk,
            Err(error) => {
                drop(temp_file);
                let _ = std::fs::remove_file(&temp_path);
                return Err(error.to_string());
            }
        };
        if let Err(error) = temp_file.write_all(&chunk) {
            drop(temp_file);
            let _ = std::fs::remove_file(&temp_path);
            return Err(error.to_string());
        }
        bytes_written += chunk.len() as u64;
    }
    if let Err(error) = temp_file.sync_all() {
        drop(temp_file);
        let _ = std::fs::remove_file(&temp_path);
        return Err(error.to_string());
    }
    drop(temp_file);
    if let Err(error) = std::fs::rename(&temp_path, destination_path) {
        let _ = std::fs::remove_file(&temp_path);
        return Err(error.to_string());
    }
    let (sha256, reopened_bytes) = sha256_file(destination_path)?;

    Ok(DownloadedFileInfo {
        path: destination_path.to_string_lossy().to_string(),
        bytes_written,
        sha256,
        reopened: true,
        reopened_bytes,
    })
}

#[cfg(test)]
fn sha256_hex(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

fn sha256_file(path: &std::path::Path) -> Result<(String, u64), String> {
    let mut file = std::fs::File::open(path).map_err(|e| e.to_string())?;
    let mut hasher = Sha256::new();
    let mut bytes_read = 0_u64;
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        let count = file.read(&mut buffer).map_err(|e| e.to_string())?;
        if count == 0 {
            break;
        }
        hasher.update(&buffer[..count]);
        bytes_read += count as u64;
    }
    Ok((format!("{:x}", hasher.finalize()), bytes_read))
}

async fn upload_local_file_core<F>(
    api_base_url: &str,
    note_id: &str,
    path: &str,
    content_type: Option<String>,
    media_optimize: Option<bool>,
    headers: Option<HashMap<String, String>>,
    mut on_progress: F,
) -> Result<serde_json::Value, String>
where
    F: FnMut(u64, u64),
{
    let file_path = std::path::PathBuf::from(path);
    let metadata = std::fs::metadata(&file_path).map_err(|e| e.to_string())?;
    if !metadata.is_file() {
        return Err(format!("not a file: {}", path));
    }

    let filename = file_path
        .file_name()
        .and_then(|v| v.to_str())
        .ok_or_else(|| "file path has no valid filename".to_string())?
        .to_string();
    let content_type = content_type.unwrap_or_else(|| guess_content_type(&filename).to_string());
    let endpoint = format!(
        "{}/notes/{}/attachments/tus",
        api_base_url.trim_end_matches('/'),
        note_id
    );

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(3600))
        .build()
        .map_err(|e| e.to_string())?;

    let mut req = client
        .post(&endpoint)
        .header("Tus-Resumable", "1.0.0")
        .header("Upload-Length", metadata.len().to_string())
        .header(
            "Upload-Metadata",
            build_tus_metadata(&filename, &content_type, media_optimize.unwrap_or(false)),
        );
    if let Some(hdrs) = &headers {
        for (k, v) in hdrs {
            req = req.header(k, v);
        }
    }

    let create_resp = req.send().await.map_err(|e| e.to_string())?;
    if !create_resp.status().is_success() {
        let status = create_resp.status();
        let body = create_resp.text().await.unwrap_or_default();
        return Err(format!(
            "TUS create failed: HTTP {} {}",
            status.as_u16(),
            body
        ));
    }
    on_progress(0, metadata.len());

    let location = create_resp
        .headers()
        .get(reqwest::header::LOCATION)
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| "TUS create response missing Location".to_string())?;
    let upload_url = reqwest::Url::parse(&endpoint)
        .map_err(|e| e.to_string())?
        .join(location)
        .map_err(|e| e.to_string())?;

    let mut file = std::fs::File::open(&file_path).map_err(|e| e.to_string())?;
    let mut offset: u64 = 0;
    let mut final_attachment: Option<serde_json::Value> = None;
    let mut buffer = vec![0_u8; 1024 * 1024];

    loop {
        let n = file.read(&mut buffer).map_err(|e| e.to_string())?;
        if n == 0 {
            break;
        }

        let mut patch = client
            .patch(upload_url.clone())
            .header("Tus-Resumable", "1.0.0")
            .header("Upload-Offset", offset.to_string())
            .header("Content-Type", "application/offset+octet-stream")
            .body(buffer[..n].to_vec());
        if let Some(hdrs) = &headers {
            for (k, v) in hdrs {
                patch = patch.header(k, v);
            }
        }

        let resp = patch.send().await.map_err(|e| e.to_string())?;
        let status = resp.status();
        if !status.is_success() {
            if status == reqwest::StatusCode::CONFLICT {
                let mut head = client
                    .head(upload_url.clone())
                    .header("Tus-Resumable", "1.0.0");
                if let Some(hdrs) = &headers {
                    for (k, v) in hdrs {
                        head = head.header(k, v);
                    }
                }
                let head_resp = head.send().await.map_err(|e| e.to_string())?;
                if !head_resp.status().is_success() {
                    let head_status = head_resp.status();
                    let body = head_resp.text().await.unwrap_or_default();
                    return Err(format!(
                        "TUS resume HEAD failed after conflict at offset {}: HTTP {} {}",
                        offset,
                        head_status.as_u16(),
                        body
                    ));
                }
                let server_offset = head_resp
                    .headers()
                    .get("Upload-Offset")
                    .and_then(|v| v.to_str().ok())
                    .and_then(|v| v.parse::<u64>().ok())
                    .ok_or_else(|| "TUS resume HEAD response missing Upload-Offset".to_string())?;
                if server_offset > metadata.len() {
                    return Err(format!(
                        "TUS resume offset {} exceeds local file size {}",
                        server_offset,
                        metadata.len()
                    ));
                }
                file.seek(SeekFrom::Start(server_offset))
                    .map_err(|e| e.to_string())?;
                offset = server_offset;
                on_progress(offset, metadata.len());
                continue;
            }
            let body = resp.text().await.unwrap_or_default();
            return Err(format!(
                "TUS patch failed at offset {}: HTTP {} {}",
                offset,
                status.as_u16(),
                body
            ));
        }

        offset += n as u64;
        if let Some(server_offset) = resp
            .headers()
            .get("Upload-Offset")
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.parse::<u64>().ok())
        {
            offset = server_offset;
        }
        on_progress(offset, metadata.len());

        if offset == metadata.len() {
            final_attachment = Some(
                resp.json::<serde_json::Value>()
                    .await
                    .map_err(|e| e.to_string())?,
            );
            break;
        }
    }

    if let Some(attachment) = final_attachment {
        return Ok(attachment);
    }

    let mut get = client.get(upload_url);
    if let Some(hdrs) = &headers {
        for (k, v) in hdrs {
            get = get.header(k, v);
        }
    }
    let resp = get.send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!(
            "TUS finalize failed: HTTP {} {}",
            status.as_u16(),
            body
        ));
    }
    resp.json::<serde_json::Value>()
        .await
        .map_err(|e| e.to_string())
}

fn emit_upload_progress(
    app: &tauri::AppHandle,
    upload_id: &Option<String>,
    bytes_uploaded: u64,
    bytes_total: u64,
) {
    if let Some(upload_id) = upload_id {
        let _ = app.emit(
            "hotm-upload-progress",
            UploadProgress {
                upload_id: upload_id.clone(),
                bytes_uploaded,
                bytes_total,
            },
        );
    }
}

fn build_tus_metadata(filename: &str, content_type: &str, media_optimize: bool) -> String {
    let mut parts = vec![
        format!("filename {}", B64.encode(filename.as_bytes())),
        format!("filetype {}", B64.encode(content_type.as_bytes())),
    ];
    if media_optimize {
        parts.push(format!("media_optimize {}", B64.encode(b"true")));
    }
    parts.join(",")
}

fn guess_content_type(filename: &str) -> &'static str {
    match std::path::Path::new(filename)
        .extension()
        .and_then(|v| v.to_str())
        .map(|v| v.to_ascii_lowercase())
        .as_deref()
    {
        Some("mp4") | Some("m4v") => "video/mp4",
        Some("mov") => "video/quicktime",
        Some("webm") => "video/webm",
        Some("mkv") => "video/x-matroska",
        Some("mp3") => "audio/mpeg",
        Some("wav") => "audio/wav",
        Some("flac") => "audio/flac",
        Some("m4a") => "audio/mp4",
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("webp") => "image/webp",
        Some("pdf") => "application/pdf",
        Some("txt") | Some("md") => "text/plain",
        Some("json") => "application/json",
        Some("csv") => "text/csv",
        _ => "application/octet-stream",
    }
}

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
        .timeout(std::time::Duration::from_secs(600))
        .build()
        .map_err(|e| e.to_string())?;

    let method_str = method.as_deref().unwrap_or("GET");
    let method = reqwest::Method::from_bytes(method_str.as_bytes()).map_err(|e| e.to_string())?;

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
    let status_text = resp.status().canonical_reason().unwrap_or("").to_string();

    let mut resp_headers = serde_json::Map::new();
    for (k, v) in resp.headers() {
        if let Ok(vs) = v.to_str() {
            resp_headers.insert(
                k.as_str().to_string(),
                serde_json::Value::String(vs.to_string()),
            );
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
                                let t = if ev_type.is_empty() {
                                    "message"
                                } else {
                                    &ev_type
                                };
                                let id = if ev_id.is_empty() {
                                    None
                                } else {
                                    Some(ev_id.as_str())
                                };
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
    plantuml::render_plantuml(&app, &code)
        .await
        .map_err(|e| e.to_string())
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

            let left_dist = ((fx - (cx - 3.0)).powi(2) / 49.0 + (fy - cy).powi(2) / 81.0).sqrt();
            let is_left_hemisphere = left_dist <= 1.0 && fx <= cx;

            let right_dist = ((fx - (cx + 3.0)).powi(2) / 49.0 + (fy - cy).powi(2) / 81.0).sqrt();
            let is_right_hemisphere = right_dist <= 1.0 && fx >= cx;

            let is_division = fx >= cx - 0.5 && fx <= cx + 0.5 && fy >= cy - 8.0 && fy <= cy + 6.0;

            let fold1 = (fx >= cx - 6.0 && fx <= cx - 4.0 && fy >= cy - 3.0 && fy <= cy + 3.0)
                || (fx >= cx + 4.0 && fx <= cx + 6.0 && fy >= cy - 3.0 && fy <= cy + 3.0);

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
    let start_minimized =
        args.contains(&"--minimized".to_string()) || args.contains(&"/minimized".to_string());

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
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_http::init())
        .plugin(shortcut_plugin)
        .invoke_handler(tauri::generate_handler![
            render_plantuml,
            ensure_plantuml,
            get_app_config,
            save_app_config,
            hotm_fetch,
            hotm_pick_local_files,
            hotm_upload_local_file,
            hotm_download_attachment_to_file,
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

                    eprintln!(
                        "HotM: launching Fortemi sidecar on {} (storage: {})",
                        api_url, file_storage
                    );

                    let whisper_base_url = if cfg.components.whisper {
                        cfg.whisper_base_url.trim().to_string()
                    } else {
                        String::new()
                    };

                    let mut sidecar = app
                        .shell()
                        .sidecar("hotm-matric-api")
                        .map_err(|e| format!("sidecar not found: {e}"))?
                        .env("DATABASE_URL", &cfg.database_url)
                        .env("HOST", "127.0.0.1")
                        .env("PORT", port.to_string())
                        .env("FILE_STORAGE_PATH", &file_storage)
                        .env("MATRIC_MAX_UPLOAD_SIZE_BYTES", "2147483648")
                        .env("WHISPER_BASE_URL", whisper_base_url)
                        // The bundled desktop sidecar is private to localhost and the
                        // webview host adapter. Fortemi now defaults to fail-closed
                        // auth, so explicitly opt this embedded mode into anonymous
                        // local access until HotM bootstraps OAuth tokens.
                        .env("REQUIRE_AUTH", "false")
                        .env("I_UNDERSTAND_NO_AUTH", "true")
                        .env("RATE_LIMIT_ENABLED", "false");

                    if cfg.components.ollama {
                        sidecar = sidecar.env("OLLAMA_BASE", cfg.ollama_base_url.trim());
                    }

                    let (rx, child) = sidecar
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
                            let deadline =
                                std::time::Instant::now() + std::time::Duration::from_secs(30);
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

#[cfg(test)]
mod tests {
    use super::{
        describe_local_files, download_attachment_to_file_core, sha256_hex, upload_local_file_core,
    };
    use base64::{engine::general_purpose::STANDARD as B64, Engine};
    use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION};
    use serde_json::{json, Value};
    use std::collections::HashMap;
    use std::io::{Read, Write};
    use std::net::{TcpListener, TcpStream};
    use std::path::Path;
    use std::sync::{Arc, Mutex};

    #[derive(Debug, Default)]
    struct TusReceipt {
        create_headers: HashMap<String, String>,
        patch_headers: HashMap<String, String>,
        head_headers: HashMap<String, String>,
        resume_patch_headers: HashMap<String, String>,
        uploaded_bytes: Vec<u8>,
        resume_uploaded_bytes: Vec<u8>,
    }

    #[tokio::test]
    async fn local_file_upload_core_sends_desktop_bytes_auth_headers_and_progress() {
        let expected_bytes = b"HotM desktop local-file receipt bytes.\n".to_vec();
        let tempdir = tempfile::tempdir().expect("create tempdir");
        let file_path = tempdir.path().join("desktop-local.bin");
        std::fs::write(&file_path, &expected_bytes).expect("write local file");

        let receipt = Arc::new(Mutex::new(TusReceipt::default()));
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind local TUS server");
        let api_base_url = format!("http://{}/api/v1", listener.local_addr().unwrap());
        let server_receipt = Arc::clone(&receipt);
        let expected_len = expected_bytes.len();

        let server = std::thread::spawn(move || {
            for stream in listener.incoming().take(2) {
                let mut stream = stream.expect("accept request");
                let request = read_http_request(&mut stream);
                let mut guard = server_receipt.lock().unwrap();
                match request.method_path.as_str() {
                    "POST /api/v1/notes/note-1/attachments/tus" => {
                        guard.create_headers = request.headers;
                        write_response(
                            &mut stream,
                            201,
                            &[
                                ("Location", "/api/v1/uploads/upload-1"),
                                ("Tus-Resumable", "1.0.0"),
                            ],
                            b"",
                        );
                    }
                    "PATCH /api/v1/uploads/upload-1" => {
                        guard.patch_headers = request.headers;
                        guard.uploaded_bytes = request.body;
                        let body =
                            br#"{"id":"att-local","filename":"desktop-local.bin","size_bytes":39}"#;
                        let offset = expected_len.to_string();
                        write_response(
                            &mut stream,
                            200,
                            &[
                                ("Content-Type", "application/json"),
                                ("Tus-Resumable", "1.0.0"),
                                ("Upload-Offset", &offset),
                            ],
                            body,
                        );
                    }
                    other => panic!("unexpected request: {other}"),
                }
            }
        });

        let mut headers = HashMap::new();
        headers.insert(
            "Authorization".to_string(),
            "Bearer desktop-token".to_string(),
        );
        headers.insert(
            "X-Fortemi-Memory".to_string(),
            "hotm_desktop_receipt".to_string(),
        );

        let mut progress = Vec::new();
        let attachment = upload_local_file_core(
            &api_base_url,
            "note-1",
            file_path.to_str().unwrap(),
            Some("application/octet-stream".to_string()),
            Some(true),
            Some(headers),
            |bytes_uploaded, bytes_total| progress.push((bytes_uploaded, bytes_total)),
        )
        .await
        .expect("upload local file through TUS core");

        server.join().expect("join local TUS server");

        assert_eq!(attachment["id"], "att-local");
        assert_eq!(
            progress,
            vec![
                (0, expected_len as u64),
                (expected_len as u64, expected_len as u64)
            ]
        );

        let receipt = receipt.lock().unwrap();
        assert_eq!(
            receipt
                .create_headers
                .get("authorization")
                .map(String::as_str),
            Some("Bearer desktop-token")
        );
        assert_eq!(
            receipt
                .patch_headers
                .get("authorization")
                .map(String::as_str),
            Some("Bearer desktop-token")
        );
        assert_eq!(
            receipt
                .create_headers
                .get("x-fortemi-memory")
                .map(String::as_str),
            Some("hotm_desktop_receipt")
        );
        assert_eq!(
            receipt
                .patch_headers
                .get("x-fortemi-memory")
                .map(String::as_str),
            Some("hotm_desktop_receipt")
        );
        let expected_len_header = expected_len.to_string();
        assert_eq!(
            receipt
                .create_headers
                .get("upload-length")
                .map(String::as_str),
            Some(expected_len_header.as_str())
        );
        assert!(receipt
            .create_headers
            .get("upload-metadata")
            .is_some_and(|value| value.contains("media_optimize")));
        assert_eq!(receipt.uploaded_bytes, expected_bytes);
    }

    #[test]
    fn native_file_picker_paths_return_selected_local_files() {
        let tempdir = tempfile::tempdir().expect("create tempdir");
        let selected_a = tempdir.path().join("desktop-picker-a.bin");
        let selected_b = tempdir.path().join("desktop-picker-b.txt");
        std::fs::write(&selected_a, b"picker a").expect("write picker file a");
        std::fs::write(&selected_b, b"picker b contents").expect("write picker file b");

        let files = describe_local_files(vec![selected_a.clone(), selected_b.clone()])
            .expect("selected paths return local file metadata");

        assert_eq!(files.len(), 2);
        assert_eq!(files[0].path, selected_a.to_string_lossy());
        assert_eq!(files[0].name, "desktop-picker-a.bin");
        assert_eq!(files[0].size, b"picker a".len() as u64);
        assert_eq!(files[1].path, selected_b.to_string_lossy());
        assert_eq!(files[1].name, "desktop-picker-b.txt");
        assert_eq!(files[1].size, b"picker b contents".len() as u64);
    }

    #[tokio::test]
    async fn native_download_core_reopens_saved_file() {
        let expected_bytes = b"HotM native save-dialog receipt bytes.\n".to_vec();
        let tempdir = tempfile::tempdir().expect("create tempdir");
        let destination = tempdir.path().join("native-save-dialog.bin");

        let receipt = Arc::new(Mutex::new(HashMap::<String, String>::new()));
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind local download server");
        let api_base_url = format!("http://{}/api/v1", listener.local_addr().unwrap());
        let server_receipt = Arc::clone(&receipt);
        let server_bytes = expected_bytes.clone();
        let server = std::thread::spawn(move || {
            let mut stream = listener.incoming().next().unwrap().expect("accept request");
            let request = read_http_request(&mut stream);
            assert_eq!(
                request.method_path,
                "GET /api/v1/attachments/att-native-save/download?variant=original"
            );
            *server_receipt.lock().unwrap() = request.headers;
            write_response(
                &mut stream,
                200,
                &[("Content-Type", "application/octet-stream")],
                &server_bytes,
            );
        });

        let mut headers = HashMap::new();
        headers.insert(
            "Authorization".to_string(),
            "Bearer desktop-token".to_string(),
        );
        headers.insert(
            "X-Fortemi-Memory".to_string(),
            "hotm_native_save_dialog_receipt".to_string(),
        );

        let info = download_attachment_to_file_core(
            &api_base_url,
            "att-native-save",
            &destination,
            Some("original".to_string()),
            Some(headers),
        )
        .await
        .expect("native download core succeeds");

        server
            .join()
            .expect("join local save-dialog download server");

        assert_eq!(info.path, destination.to_string_lossy());
        assert_eq!(info.bytes_written, expected_bytes.len() as u64);
        assert!(info.reopened);
        assert_eq!(info.reopened_bytes, expected_bytes.len() as u64);
        assert_eq!(info.sha256, sha256_hex(&expected_bytes));
        assert_eq!(std::fs::read(&destination).unwrap(), expected_bytes);

        let receipt = receipt.lock().unwrap();
        assert_eq!(
            receipt.get("authorization").map(String::as_str),
            Some("Bearer desktop-token")
        );
        assert_eq!(
            receipt.get("x-fortemi-memory").map(String::as_str),
            Some("hotm_native_save_dialog_receipt")
        );
    }

    #[tokio::test]
    async fn local_file_upload_core_resumes_after_tus_offset_conflict() {
        let expected_bytes = b"HotM desktop resumable upload command-core bytes.\n".to_vec();
        let resume_offset = 12usize;
        let tempdir = tempfile::tempdir().expect("create tempdir");
        let file_path = tempdir.path().join("desktop-resume.bin");
        std::fs::write(&file_path, &expected_bytes).expect("write local file");

        let receipt = Arc::new(Mutex::new(TusReceipt::default()));
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind local TUS server");
        let api_base_url = format!("http://{}/api/v1", listener.local_addr().unwrap());
        let server_receipt = Arc::clone(&receipt);
        let expected_len = expected_bytes.len();

        let server = std::thread::spawn(move || {
            for stream in listener.incoming().take(4) {
                let mut stream = stream.expect("accept request");
                let request = read_http_request(&mut stream);
                let mut guard = server_receipt.lock().unwrap();
                match request.method_path.as_str() {
                    "POST /api/v1/notes/note-resume/attachments/tus" => {
                        guard.create_headers = request.headers;
                        write_response(
                            &mut stream,
                            201,
                            &[
                                ("Location", "/api/v1/uploads/upload-resume"),
                                ("Tus-Resumable", "1.0.0"),
                            ],
                            b"",
                        );
                    }
                    "PATCH /api/v1/uploads/upload-resume" if guard.patch_headers.is_empty() => {
                        guard.patch_headers = request.headers;
                        guard.uploaded_bytes = request.body;
                        write_response(
                            &mut stream,
                            409,
                            &[("Tus-Resumable", "1.0.0")],
                            b"offset conflict",
                        );
                    }
                    "HEAD /api/v1/uploads/upload-resume" => {
                        guard.head_headers = request.headers;
                        let offset = resume_offset.to_string();
                        write_response(
                            &mut stream,
                            200,
                            &[("Tus-Resumable", "1.0.0"), ("Upload-Offset", &offset)],
                            b"",
                        );
                    }
                    "PATCH /api/v1/uploads/upload-resume" => {
                        guard.resume_patch_headers = request.headers;
                        guard.resume_uploaded_bytes = request.body;
                        let body = br#"{"id":"att-resumed","filename":"desktop-resume.bin"}"#;
                        let offset = expected_len.to_string();
                        write_response(
                            &mut stream,
                            200,
                            &[
                                ("Content-Type", "application/json"),
                                ("Tus-Resumable", "1.0.0"),
                                ("Upload-Offset", &offset),
                            ],
                            body,
                        );
                    }
                    other => panic!("unexpected request: {other}"),
                }
            }
        });

        let mut headers = HashMap::new();
        headers.insert(
            "Authorization".to_string(),
            "Bearer desktop-token".to_string(),
        );
        headers.insert(
            "X-Fortemi-Memory".to_string(),
            "hotm_desktop_resume_receipt".to_string(),
        );

        let mut progress = Vec::new();
        let attachment = upload_local_file_core(
            &api_base_url,
            "note-resume",
            file_path.to_str().unwrap(),
            Some("application/octet-stream".to_string()),
            None,
            Some(headers),
            |bytes_uploaded, bytes_total| progress.push((bytes_uploaded, bytes_total)),
        )
        .await
        .expect("resume local file upload after TUS offset conflict");

        server.join().expect("join local TUS resume server");

        assert_eq!(attachment["id"], "att-resumed");
        assert_eq!(
            progress,
            vec![
                (0, expected_len as u64),
                (resume_offset as u64, expected_len as u64),
                (expected_len as u64, expected_len as u64)
            ]
        );

        let receipt = receipt.lock().unwrap();
        assert_eq!(
            receipt
                .head_headers
                .get("authorization")
                .map(String::as_str),
            Some("Bearer desktop-token")
        );
        assert_eq!(
            receipt
                .resume_patch_headers
                .get("authorization")
                .map(String::as_str),
            Some("Bearer desktop-token")
        );
        assert_eq!(
            receipt
                .head_headers
                .get("x-fortemi-memory")
                .map(String::as_str),
            Some("hotm_desktop_resume_receipt")
        );
        assert_eq!(
            receipt
                .resume_patch_headers
                .get("x-fortemi-memory")
                .map(String::as_str),
            Some("hotm_desktop_resume_receipt")
        );
        assert_eq!(
            receipt
                .resume_patch_headers
                .get("upload-offset")
                .map(String::as_str),
            Some(resume_offset.to_string().as_str())
        );
        assert_eq!(receipt.uploaded_bytes, expected_bytes);
        assert_eq!(
            receipt.resume_uploaded_bytes,
            expected_bytes[resume_offset..].to_vec()
        );
    }

    #[tokio::test]
    async fn local_file_download_core_saves_desktop_bytes_with_auth_headers() {
        let expected_bytes = b"HotM desktop saved attachment receipt bytes.\n".to_vec();
        let receipt = Arc::new(Mutex::new(HashMap::<String, String>::new()));
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind local download server");
        let api_base_url = format!("http://{}/api/v1", listener.local_addr().unwrap());
        let server_receipt = Arc::clone(&receipt);
        let server_bytes = expected_bytes.clone();

        let server = std::thread::spawn(move || {
            let mut stream = listener.incoming().next().unwrap().expect("accept request");
            let request = read_http_request(&mut stream);
            assert_eq!(
                request.method_path,
                "GET /api/v1/attachments/att-local/download?variant=faststart"
            );
            *server_receipt.lock().unwrap() = request.headers;
            write_response(
                &mut stream,
                200,
                &[("Content-Type", "application/octet-stream")],
                &server_bytes,
            );
        });

        let tempdir = tempfile::tempdir().expect("create tempdir");
        let destination = tempdir.path().join("saved-local.bin");
        let mut headers = HashMap::new();
        headers.insert(
            "Authorization".to_string(),
            "Bearer desktop-token".to_string(),
        );
        headers.insert(
            "X-Fortemi-Memory".to_string(),
            "hotm_desktop_download_receipt".to_string(),
        );

        let info = download_attachment_to_file_core(
            &api_base_url,
            "att-local",
            &destination,
            Some("faststart".to_string()),
            Some(headers),
        )
        .await
        .expect("download attachment through desktop core");

        server.join().expect("join local download server");

        assert_eq!(info.path, destination.to_string_lossy());
        assert_eq!(info.bytes_written, expected_bytes.len() as u64);
        assert!(info.reopened);
        assert_eq!(info.reopened_bytes, expected_bytes.len() as u64);
        assert_eq!(info.sha256, sha256_hex(&expected_bytes));
        assert_eq!(std::fs::read(&destination).unwrap(), expected_bytes);

        let receipt = receipt.lock().unwrap();
        assert_eq!(
            receipt.get("authorization").map(String::as_str),
            Some("Bearer desktop-token")
        );
        assert_eq!(
            receipt.get("x-fortemi-memory").map(String::as_str),
            Some("hotm_desktop_download_receipt")
        );
    }

    #[tokio::test]
    #[ignore = "requires HOTM_LIVE_TAURI_API_URL and a signed live Fortemi server"]
    async fn live_fortemi_tauri_local_file_full_v1_recovery_receipt() {
        let api_base_url =
            std::env::var("HOTM_LIVE_TAURI_API_URL").expect("HOTM_LIVE_TAURI_API_URL is required");
        let source_memory = live_receipt_memory("HOTM_LIVE_TAURI_SOURCE_MEMORY");
        let recovery_memory = live_receipt_memory("HOTM_LIVE_TAURI_RECOVERY_MEMORY");
        assert_ne!(
            source_memory, recovery_memory,
            "source and recovery memories must differ"
        );
        let token = std::env::var("HOTM_LIVE_TAURI_API_TOKEN")
            .ok()
            .filter(|value| !value.trim().is_empty());
        let receipt_path = std::env::var("HOTM_LIVE_TAURI_RECEIPT_PATH")
            .expect("HOTM_LIVE_TAURI_RECEIPT_PATH is required");
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(120))
            .build()
            .expect("build live receipt client");

        let result = run_live_tauri_full_v1_recovery(
            &client,
            &api_base_url,
            &source_memory,
            &recovery_memory,
            token.as_deref(),
        )
        .await;

        let source_cleanup =
            delete_live_memory(&client, &api_base_url, &source_memory, token.as_deref()).await;
        let recovery_cleanup =
            delete_live_memory(&client, &api_base_url, &recovery_memory, token.as_deref()).await;

        let receipt = result.expect("live Tauri full-v1 recovery receipt");
        source_cleanup.expect("delete live source memory");
        recovery_cleanup.expect("delete live recovery memory");
        let parent = Path::new(&receipt_path)
            .parent()
            .expect("receipt path has parent");
        std::fs::create_dir_all(parent).expect("create receipt directory");
        std::fs::write(
            &receipt_path,
            serde_json::to_vec_pretty(&receipt).expect("serialize receipt"),
        )
        .expect("write live Tauri receipt");
    }

    async fn run_live_tauri_full_v1_recovery(
        client: &reqwest::Client,
        api_base_url: &str,
        source_memory: &str,
        recovery_memory: &str,
        token: Option<&str>,
    ) -> Result<Value, String> {
        create_live_memory(client, api_base_url, source_memory, token).await?;
        create_live_memory(client, api_base_url, recovery_memory, token).await?;
        assert_live_auth_mode(client, api_base_url, source_memory, token).await?;
        assert_empty_memory(client, api_base_url, recovery_memory, token).await?;

        let note_response = live_request(
            client.post(format!("{api_base_url}/notes")),
            source_memory,
            token,
        )
        .json(&json!({
            "content": "HotM live Tauri full-v1 recovery receipt",
            "format": "markdown",
            "source": "hotm-desktop-live-receipt",
            "title": "HotM live Tauri full-v1 recovery receipt",
            "tags": ["_hotm_uat"]
        }))
        .send()
        .await
        .map_err(|error| error.to_string())?;
        let note_status = note_response.status();
        let note_body: Value = note_response
            .json()
            .await
            .map_err(|error| error.to_string())?;
        if !note_status.is_success() {
            return Err(format!(
                "create source note failed ({note_status}): {note_body}"
            ));
        }
        let note_id = note_body
            .get("note_id")
            .or_else(|| note_body.get("id"))
            .and_then(Value::as_str)
            .ok_or_else(|| "create source note response omitted note id".to_string())?;

        let tempdir = tempfile::tempdir().map_err(|error| error.to_string())?;
        let source_path = tempdir.path().join("desktop-live-full-v1.bin");
        let source_bytes = deterministic_live_bytes(256 * 1024);
        std::fs::write(&source_path, &source_bytes).map_err(|error| error.to_string())?;
        let source_sha256 = sha256_hex(&source_bytes);
        let source_content_hash = blake3_content_hash(&source_bytes);
        let desktop_headers = live_desktop_headers(source_memory, token);
        let mut progress = Vec::new();
        let upload_started = std::time::Instant::now();
        let attachment = upload_local_file_core(
            api_base_url,
            note_id,
            source_path
                .to_str()
                .ok_or_else(|| "source path is not UTF-8".to_string())?,
            Some("application/octet-stream".to_string()),
            Some(false),
            Some(desktop_headers),
            |uploaded, total| progress.push((uploaded, total)),
        )
        .await?;
        let upload_millis = upload_started.elapsed().as_millis() as u64;
        let attachment_id = attachment
            .get("id")
            .and_then(Value::as_str)
            .ok_or_else(|| "Tauri upload response omitted attachment id".to_string())?;
        if progress.last().copied() != Some((source_bytes.len() as u64, source_bytes.len() as u64))
        {
            return Err("Tauri upload progress did not reach the exact file length".to_string());
        }

        let source_download_path = tempdir.path().join("source-server-download.bin");
        let source_download = download_attachment_to_file_core(
            api_base_url,
            attachment_id,
            &source_download_path,
            None,
            Some(live_desktop_headers(source_memory, token)),
        )
        .await?;
        if source_download.sha256 != source_sha256
            || source_download.bytes_written != source_bytes.len() as u64
            || !source_download.reopened
        {
            return Err("source server download did not match the desktop file".to_string());
        }

        let export_started = std::time::Instant::now();
        let export_response = live_request(
            client.get(format!(
                "{api_base_url}/backup/knowledge-shard?schema_version=2.0.0&profile=full-v1&include_blobs=true"
            )),
            source_memory,
            token,
        )
        .send()
        .await
        .map_err(|error| error.to_string())?;
        let export_status = export_response.status();
        let shard = export_response
            .bytes()
            .await
            .map_err(|error| error.to_string())?;
        if !export_status.is_success() {
            return Err(format!(
                "signed full-v1 export failed ({export_status}); response bytes={}",
                shard.len()
            ));
        }
        let export_millis = export_started.elapsed().as_millis() as u64;

        let import_started = std::time::Instant::now();
        let import_response = live_request(
            client.post(format!("{api_base_url}/backup/knowledge-shard/import")),
            recovery_memory,
            token,
        )
        .json(&json!({
            "shard_base64": B64.encode(&shard),
            "dry_run": false,
            "on_conflict": "replace",
            "skip_embedding_regen": true,
            "verify_signature": "require"
        }))
        .send()
        .await
        .map_err(|error| error.to_string())?;
        let import_status = import_response.status();
        let import_body: Value = import_response
            .json()
            .await
            .map_err(|error| error.to_string())?;
        if !import_status.is_success() {
            return Err(format!(
                "trust-required full-v1 import failed ({import_status}): {import_body}"
            ));
        }
        if import_body
            .pointer("/manifest/profile")
            .and_then(Value::as_str)
            != Some("full-v1")
        {
            return Err("import response did not identify profile full-v1".to_string());
        }
        let import_millis = import_started.elapsed().as_millis() as u64;

        let attachments_response = live_request(
            client.get(format!("{api_base_url}/notes/{note_id}/attachments")),
            recovery_memory,
            token,
        )
        .send()
        .await
        .map_err(|error| error.to_string())?;
        let attachments_status = attachments_response.status();
        let attachments_body: Value = attachments_response
            .json()
            .await
            .map_err(|error| error.to_string())?;
        if !attachments_status.is_success() {
            return Err(format!(
                "list recovered attachments failed ({attachments_status}): {attachments_body}"
            ));
        }
        let recovered_attachment = attachments_body
            .get("attachments")
            .and_then(Value::as_array)
            .or_else(|| attachments_body.as_array())
            .and_then(|attachments| {
                attachments.iter().find(|candidate| {
                    candidate.get("filename").and_then(Value::as_str)
                        == Some("desktop-live-full-v1.bin")
                })
            })
            .ok_or_else(|| "recovered attachment was not found".to_string())?;
        let recovered_attachment_id = recovered_attachment
            .get("id")
            .and_then(Value::as_str)
            .ok_or_else(|| "recovered attachment omitted id".to_string())?;
        let recovered_size = recovered_attachment
            .get("size_bytes")
            .and_then(Value::as_u64)
            .ok_or_else(|| "recovered attachment omitted size_bytes".to_string())?;
        if recovered_size != source_bytes.len() as u64 {
            return Err("recovered attachment length differs from source".to_string());
        }

        let recovery_path = tempdir.path().join("desktop-live-full-v1-recovered.bin");
        let recovery_started = std::time::Instant::now();
        let recovered_download = download_attachment_to_file_core(
            api_base_url,
            recovered_attachment_id,
            &recovery_path,
            None,
            Some(live_desktop_headers(recovery_memory, token)),
        )
        .await?;
        let recovery_download_millis = recovery_started.elapsed().as_millis() as u64;
        let recovered_bytes = std::fs::read(&recovery_path).map_err(|error| error.to_string())?;
        let recovered_content_hash = blake3_content_hash(&recovered_bytes);
        if recovered_download.sha256 != source_sha256
            || recovered_download.bytes_written != source_bytes.len() as u64
            || !recovered_download.reopened
            || recovered_content_hash != source_content_hash
            || recovered_bytes != source_bytes
        {
            return Err("recovered desktop download did not match source bytes".to_string());
        }

        let health = client
            .get(api_base_url.trim_end_matches("/api/v1").to_string() + "/health")
            .send()
            .await
            .map_err(|error| error.to_string())?
            .json::<Value>()
            .await
            .map_err(|error| error.to_string())?;
        let hotm_commit = command_output("git", &["rev-parse", "HEAD"]);
        let hotm_worktree_dirty = command_output_allow_empty("git", &["status", "--porcelain"])
            .map(|status| !status.is_empty());

        Ok(json!({
            "schemaVersion": "hotm.desktop-live-full-v1-recovery-receipt.v1",
            "receipt": "hotm-desktop-live-full-v1-recovery",
            "issue": "Fortemi/HotM#283",
            "status": "passed",
            "profile": "2.0.0/full-v1",
            "identity": {
                "hotmGitCommit": hotm_commit,
                "hotmWorktreeDirty": hotm_worktree_dirty,
                "fortemiGitCommit": health.get("git_sha"),
                "fortemiVersion": health.get("version"),
                "authenticationRequired": token.is_some(),
                "bearerTokenSupplied": token.is_some(),
                "storageBackend": "filesystem"
            },
            "source": {
                "memory": source_memory,
                "noteId": note_id,
                "attachmentId": attachment_id,
                "filename": "desktop-live-full-v1.bin",
                "bytes": source_bytes.len(),
                "sha256": source_sha256,
                "contentHash": source_content_hash
            },
            "recovery": {
                "memory": recovery_memory,
                "attachmentId": recovered_attachment_id,
                "filename": "desktop-live-full-v1.bin",
                "bytes": recovered_size,
                "sha256": recovered_download.sha256,
                "contentHash": recovered_content_hash,
                "savedFileReopened": recovered_download.reopened,
                "signaturePolicy": "require"
            },
            "timingsMillis": {
                "tauriLocalFileUpload": upload_millis,
                "signedFullV1Export": export_millis,
                "trustRequiredFullV1Import": import_millis,
                "tauriRecoveredFileDownload": recovery_download_millis,
                "recoveryRtoImportAndDownload": import_millis + recovery_download_millis
            },
            "archiveBytes": shard.len(),
            "claims": {
                "tauriLocalFileCoreAgainstLiveFortemiPassed": true,
                "trustRequiredSignedFullV1RecoveryPassed": true,
                "sourceServerRecoveryBytesPassed": true,
                "desktopDownloadCoreSavedAndReopenedPassed": true,
                "launchedTauriGuiInThisRunPassed": false,
                "interactiveNativeDialogsInThisRunPassed": false,
                "immutableCiArtifactPublished": false,
                "suiteWidePortability": false
            },
            "notClaimed": [
                "launched Tauri GUI operation in this command-core run",
                "interactive native picker or save dialog in this command-core run",
                "immutable CI artifact publication before upload completes",
                "non-Linux desktop platforms",
                "suite-wide portability or complete backup"
            ]
        }))
    }

    fn live_receipt_memory(name: &str) -> String {
        let value = std::env::var(name).unwrap_or_else(|_| panic!("{name} is required"));
        assert!(
            value.starts_with("hotm_live_"),
            "{name} must use the isolated hotm_live_ prefix"
        );
        value
    }

    fn live_desktop_headers(memory: &str, token: Option<&str>) -> HashMap<String, String> {
        let mut headers = HashMap::from([("X-Fortemi-Memory".to_string(), memory.to_string())]);
        if let Some(token) = token {
            headers.insert("Authorization".to_string(), format!("Bearer {token}"));
        }
        headers
    }

    fn live_request(
        request: reqwest::RequestBuilder,
        memory: &str,
        token: Option<&str>,
    ) -> reqwest::RequestBuilder {
        let mut headers = HeaderMap::new();
        headers.insert(
            "X-Fortemi-Memory",
            HeaderValue::from_str(memory).expect("valid memory header"),
        );
        if let Some(token) = token {
            headers.insert(
                AUTHORIZATION,
                HeaderValue::from_str(&format!("Bearer {token}")).expect("valid bearer header"),
            );
        }
        request.headers(headers)
    }

    async fn create_live_memory(
        client: &reqwest::Client,
        api_base_url: &str,
        memory: &str,
        token: Option<&str>,
    ) -> Result<(), String> {
        let mut request = client.post(format!("{api_base_url}/archives"));
        if let Some(token) = token {
            request = request.header(AUTHORIZATION, format!("Bearer {token}"));
        }
        let response = request
            .json(&json!({
                "name": memory,
                "description": "HotM live Tauri signed full-v1 receipt"
            }))
            .send()
            .await
            .map_err(|error| error.to_string())?;
        if response.status() != reqwest::StatusCode::CREATED {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(format!(
                "create isolated memory {memory} failed ({status}): {body}"
            ));
        }
        Ok(())
    }

    async fn assert_empty_memory(
        client: &reqwest::Client,
        api_base_url: &str,
        memory: &str,
        token: Option<&str>,
    ) -> Result<(), String> {
        let response = live_request(
            client.get(format!("{api_base_url}/notes?limit=1")),
            memory,
            token,
        )
        .send()
        .await
        .map_err(|error| error.to_string())?;
        let status = response.status();
        let body: Value = response.json().await.map_err(|error| error.to_string())?;
        if !status.is_success() {
            return Err(format!(
                "query clean recovery memory failed ({status}): {body}"
            ));
        }
        let count = body
            .get("notes")
            .and_then(Value::as_array)
            .map_or(0, Vec::len);
        if count != 0 {
            return Err("recovery memory was not clean before import".to_string());
        }
        Ok(())
    }

    async fn assert_live_auth_mode(
        client: &reqwest::Client,
        api_base_url: &str,
        memory: &str,
        token: Option<&str>,
    ) -> Result<(), String> {
        if token.is_none() {
            return Ok(());
        }
        let status = client
            .get(format!("{api_base_url}/notes?limit=1"))
            .header("X-Fortemi-Memory", memory)
            .send()
            .await
            .map_err(|error| error.to_string())?
            .status();
        if status != reqwest::StatusCode::UNAUTHORIZED {
            return Err(format!(
                "bearer-auth receipt requires unauthenticated notes to return 401, got {status}"
            ));
        }
        Ok(())
    }

    async fn delete_live_memory(
        client: &reqwest::Client,
        api_base_url: &str,
        memory: &str,
        token: Option<&str>,
    ) -> Result<(), String> {
        let response = live_request(
            client.delete(format!("{api_base_url}/archives/{memory}")),
            memory,
            token,
        )
        .send()
        .await
        .map_err(|error| error.to_string())?;
        if !response.status().is_success() {
            return Err(format!(
                "delete isolated memory {memory} failed ({})",
                response.status()
            ));
        }
        Ok(())
    }

    fn deterministic_live_bytes(length: usize) -> Vec<u8> {
        (0..length)
            .map(|index| ((index * 31 + index / 257 + 41) % 251) as u8)
            .collect()
    }

    fn blake3_content_hash(bytes: &[u8]) -> String {
        format!("blake3:{}", blake3::hash(bytes).to_hex())
    }

    fn command_output(program: &str, args: &[&str]) -> Option<String> {
        command_output_allow_empty(program, args).filter(|value| !value.is_empty())
    }

    fn command_output_allow_empty(program: &str, args: &[&str]) -> Option<String> {
        std::process::Command::new(program)
            .args(args)
            .output()
            .ok()
            .and_then(|output| {
                output
                    .status
                    .success()
                    .then(|| String::from_utf8_lossy(&output.stdout).trim().to_string())
            })
    }

    struct HttpRequest {
        method_path: String,
        headers: HashMap<String, String>,
        body: Vec<u8>,
    }

    fn read_http_request(stream: &mut TcpStream) -> HttpRequest {
        let mut buffer = Vec::new();
        let mut chunk = [0_u8; 4096];
        let header_end = loop {
            let n = stream.read(&mut chunk).expect("read request");
            assert!(n > 0, "connection closed before headers");
            buffer.extend_from_slice(&chunk[..n]);
            if let Some(pos) = find_header_end(&buffer) {
                break pos;
            }
        };

        let headers_text = String::from_utf8(buffer[..header_end].to_vec()).unwrap();
        let mut lines = headers_text.split("\r\n");
        let request_line = lines.next().unwrap();
        let mut request_parts = request_line.split_whitespace();
        let method = request_parts.next().unwrap();
        let path = request_parts.next().unwrap();
        let method_path = format!("{method} {path}");
        let mut headers = HashMap::new();
        for line in lines.filter(|line| !line.is_empty()) {
            let (name, value) = line.split_once(':').expect("valid header");
            headers.insert(name.to_ascii_lowercase(), value.trim().to_string());
        }

        let content_length = headers
            .get("content-length")
            .and_then(|value| value.parse::<usize>().ok())
            .unwrap_or(0);
        let body_start = header_end + 4;
        let mut body = buffer[body_start..].to_vec();
        while body.len() < content_length {
            let n = stream.read(&mut chunk).expect("read body");
            assert!(n > 0, "connection closed before body");
            body.extend_from_slice(&chunk[..n]);
        }
        body.truncate(content_length);

        HttpRequest {
            method_path,
            headers,
            body,
        }
    }

    fn find_header_end(buffer: &[u8]) -> Option<usize> {
        buffer.windows(4).position(|window| window == b"\r\n\r\n")
    }

    fn write_response(stream: &mut TcpStream, status: u16, headers: &[(&str, &str)], body: &[u8]) {
        let reason = match status {
            200 => "OK",
            201 => "Created",
            _ => "Error",
        };
        write!(
            stream,
            "HTTP/1.1 {status} {reason}\r\nContent-Length: {}\r\nConnection: close\r\n",
            body.len()
        )
        .expect("write response head");
        for (name, value) in headers {
            write!(stream, "{name}: {value}\r\n").expect("write response header");
        }
        stream.write_all(b"\r\n").expect("finish response headers");
        stream.write_all(body).expect("write response body");
    }
}
