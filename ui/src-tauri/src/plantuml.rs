use tauri::AppHandle;

#[derive(Debug)]
pub enum PlantUMLError {
    ServerNotAvailable,
    RenderFailed(String),
    NetworkError(String),
}

impl std::fmt::Display for PlantUMLError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PlantUMLError::ServerNotAvailable => write!(f, "PlantUML server is not available"),
            PlantUMLError::RenderFailed(msg) => write!(f, "Failed to render diagram: {}", msg),
            PlantUMLError::NetworkError(msg) => write!(f, "Network error: {}", msg),
        }
    }
}

/// Encode PlantUML text to the special encoding used by PlantUML server
fn encode_plantuml(text: &str) -> String {
    use flate2::write::DeflateEncoder;
    use flate2::Compression;
    use std::io::Write;

    let mut encoder = DeflateEncoder::new(Vec::new(), Compression::default());
    encoder.write_all(text.as_bytes()).unwrap();
    let compressed = encoder.finish().unwrap();

    encode_plantuml_deflate(&compressed)
}

fn encode_plantuml_deflate(data: &[u8]) -> String {
    let mut result = String::new();
    let mut i = 0;

    while i < data.len() {
        if i + 2 < data.len() {
            let b1 = data[i];
            let b2 = data[i + 1];
            let b3 = data[i + 2];

            result.push(encode6bit((b1 >> 2) & 0x3F));
            result.push(encode6bit(((b1 & 0x3) << 4) | ((b2 >> 4) & 0xF)));
            result.push(encode6bit(((b2 & 0xF) << 2) | ((b3 >> 6) & 0x3)));
            result.push(encode6bit(b3 & 0x3F));

            i += 3;
        } else if i + 1 < data.len() {
            let b1 = data[i];
            let b2 = data[i + 1];

            result.push(encode6bit((b1 >> 2) & 0x3F));
            result.push(encode6bit(((b1 & 0x3) << 4) | ((b2 >> 4) & 0xF)));
            result.push(encode6bit((b2 & 0xF) << 2));

            i += 2;
        } else {
            let b1 = data[i];

            result.push(encode6bit((b1 >> 2) & 0x3F));
            result.push(encode6bit((b1 & 0x3) << 4));

            i += 1;
        }
    }

    result
}

fn encode6bit(b: u8) -> char {
    if b < 10 {
        return (b + 48) as char; // 0-9
    }
    if b < 36 {
        return (b + 65 - 10) as char; // A-Z
    }
    if b < 62 {
        return (b + 97 - 36) as char; // a-z
    }
    if b == 62 {
        return '-';
    }
    '_'
}

/// Render PlantUML code to SVG using PlantUML server
pub async fn render_plantuml(_app: &AppHandle, code: &str) -> Result<String, PlantUMLError> {
    let server_url = "http://localhost:8080";
    let encoded = encode_plantuml(code);
    let url = format!("{}/svg/{}", server_url, encoded);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e: reqwest::Error| PlantUMLError::NetworkError(e.to_string()))?;

    let response = client.get(&url).send().await.map_err(|e: reqwest::Error| {
        if e.is_connect() {
            PlantUMLError::ServerNotAvailable
        } else {
            PlantUMLError::NetworkError(e.to_string())
        }
    })?;

    if !response.status().is_success() {
        return Err(PlantUMLError::RenderFailed(format!(
            "Server returned status {}",
            response.status()
        )));
    }

    response
        .text()
        .await
        .map_err(|e| PlantUMLError::RenderFailed(format!("Failed to read SVG response: {}", e)))
}

/// Check if PlantUML server is available
pub async fn ensure_plantuml_jar(_app: &AppHandle) -> Result<(), PlantUMLError> {
    let server_url = "http://localhost:8080";

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| PlantUMLError::NetworkError(e.to_string()))?;

    client
        .get(server_url)
        .send()
        .await
        .map_err(|_| PlantUMLError::ServerNotAvailable)?;

    Ok(())
}
