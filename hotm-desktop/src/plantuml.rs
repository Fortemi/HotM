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
    
    // Compress the text
    let mut encoder = DeflateEncoder::new(Vec::new(), Compression::default());
    encoder.write_all(text.as_bytes()).unwrap();
    let compressed = encoder.finish().unwrap();
    
    // Encode to PlantUML's custom base64-like encoding
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
        return (b + 48) as char;  // 0-9
    }
    if b < 36 {
        return (b + 65 - 10) as char;  // A-Z
    }
    if b < 62 {
        return (b + 97 - 36) as char;  // a-z
    }
    if b == 62 {
        return '-';
    }
    '_'
}

/// Render PlantUML code to SVG using PlantUML server
pub fn render_plantuml(_app: &AppHandle, code: &str) -> Result<String, PlantUMLError> {
    // PlantUML server URL (local server on port 8080)
    let server_url = "http://localhost:8080";
    
    // Encode the PlantUML code
    let encoded = encode_plantuml(code);
    
    // Build the URL for SVG generation
    let url = format!("{}/svg/{}", server_url, encoded);
    
    eprintln!("PlantUML: Requesting from server: {}", url);
    
    // Make HTTP request to PlantUML server
    let response = match ureq::get(&url).call() {
        Ok(response) => response,
        Err(e) => {
            eprintln!("PlantUML: Request error: {}", e);
            return match e {
                ureq::Error::Http(http_error) => {
                    eprintln!("PlantUML: Server returned HTTP error: {}", http_error);
                    Err(PlantUMLError::ServerNotAvailable)
                }
                _ => {
                    eprintln!("PlantUML: Transport/IO error");
                    Err(PlantUMLError::NetworkError(format!("Failed to connect to PlantUML server: {}", e)))
                }
            };
        }
    };
    
    // Read the SVG response using ureq 3.x API
    let mut body = response.into_body();
    let svg = match body.read_to_string() {
        Ok(svg) => svg,
        Err(e) => {
            eprintln!("PlantUML: Failed to read response: {}", e);
            return Err(PlantUMLError::RenderFailed(format!("Failed to read SVG response: {}", e)));
        }
    };
    
    eprintln!("PlantUML: Successfully rendered diagram ({} bytes)", svg.len());
    Ok(svg)
}

/// Ensure PlantUML server is available (no longer needs to download JAR)
pub async fn ensure_plantuml_jar(_app: &AppHandle) -> Result<(), PlantUMLError> {
    // Check if server is available
    let server_url = "http://localhost:8080";
    
    match ureq::get(server_url).call() {
        Ok(_) => {
            eprintln!("PlantUML: Server is available at {}", server_url);
            Ok(())
        }
        Err(_) => {
            eprintln!("PlantUML: Server not available at {}", server_url);
            Err(PlantUMLError::ServerNotAvailable)
        }
    }
}