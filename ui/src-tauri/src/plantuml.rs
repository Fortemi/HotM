use std::process::Command;
use std::path::PathBuf;
use std::fs;
use tauri::{AppHandle, Manager};

#[derive(Debug)]
pub enum PlantUMLError {
    JavaNotFound,
    PlantUMLJarNotFound,
    RenderFailed(String),
    IoError(std::io::Error),
}

impl std::fmt::Display for PlantUMLError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PlantUMLError::JavaNotFound => write!(f, "Java is not installed or not in PATH"),
            PlantUMLError::PlantUMLJarNotFound => write!(f, "PlantUML JAR file not found"),
            PlantUMLError::RenderFailed(msg) => write!(f, "Failed to render diagram: {}", msg),
            PlantUMLError::IoError(e) => write!(f, "IO error: {}", e),
        }
    }
}

impl From<std::io::Error> for PlantUMLError {
    fn from(e: std::io::Error) -> Self {
        PlantUMLError::IoError(e)
    }
}

/// Get the path to the PlantUML JAR file
fn get_plantuml_jar_path(app: &AppHandle) -> Result<PathBuf, PlantUMLError> {
    // Try multiple locations for the PlantUML JAR
    let possible_paths = vec![
        // In the app's resource directory
        app.path().resource_dir()
            .map(|p| p.join("plantuml.jar"))
            .ok(),
        // In the app's data directory
        app.path().app_data_dir()
            .map(|p| p.join("plantuml.jar"))
            .ok(),
        // In the same directory as the executable
        std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|d| d.join("plantuml.jar"))),
        // In a libs subdirectory
        std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|d| d.join("libs").join("plantuml.jar"))),
    ];

    for path_opt in possible_paths {
        if let Some(path) = path_opt {
            if path.exists() {
                return Ok(path);
            }
        }
    }

    Err(PlantUMLError::PlantUMLJarNotFound)
}

/// Check if Java is available
fn check_java() -> Result<(), PlantUMLError> {
    let output = Command::new("java")
        .arg("-version")
        .output();

    match output {
        Ok(o) if o.status.success() => Ok(()),
        _ => Err(PlantUMLError::JavaNotFound),
    }
}

/// Render PlantUML code to SVG
pub fn render_plantuml(app: &AppHandle, code: &str) -> Result<String, PlantUMLError> {
    // Check Java availability
    check_java()?;
    
    // Get PlantUML JAR path
    let jar_path = get_plantuml_jar_path(app)?;
    
    // Create temporary directory for input/output
    let temp_dir = std::env::temp_dir();
    let input_file = temp_dir.join(format!("plantuml_input_{}.puml", 
        std::process::id()));
    let output_file = temp_dir.join(format!("plantuml_input_{}.svg", 
        std::process::id()));
    
    // Write PlantUML code to temporary file
    fs::write(&input_file, code)?;
    
    // Run PlantUML
    let output = Command::new("java")
        .arg("-jar")
        .arg(&jar_path)
        .arg("-tsvg")
        .arg("-charset")
        .arg("UTF-8")
        .arg(&input_file)
        .output()?;
    
    // Clean up input file
    let _ = fs::remove_file(&input_file);
    
    if !output.status.success() {
        let error_msg = String::from_utf8_lossy(&output.stderr);
        return Err(PlantUMLError::RenderFailed(error_msg.to_string()));
    }
    
    // Read the generated SVG
    if output_file.exists() {
        let svg = fs::read_to_string(&output_file)?;
        // Clean up output file
        let _ = fs::remove_file(&output_file);
        Ok(svg)
    } else {
        Err(PlantUMLError::RenderFailed("SVG file not generated".to_string()))
    }
}

/// Download PlantUML JAR if not present
pub async fn ensure_plantuml_jar(app: &AppHandle) -> Result<(), PlantUMLError> {
    // Check if JAR already exists
    if get_plantuml_jar_path(app).is_ok() {
        return Ok(());
    }
    
    // Download PlantUML JAR from official release
    let jar_url = "https://github.com/plantuml/plantuml/releases/download/v1.2025.4/plantuml-1.2025.4.jar";
    
    // Download to app data directory
    let target_path = app.path().app_data_dir()
        .map_err(|_| PlantUMLError::IoError(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            "Cannot determine app data directory"
        )))?
        .join("plantuml.jar");
    
    // Create directory if it doesn't exist
    if let Some(parent) = target_path.parent() {
        fs::create_dir_all(parent)?;
    }
    
    // Download the JAR file
    let response = reqwest::get(jar_url)
        .await
        .map_err(|e| PlantUMLError::RenderFailed(format!("Failed to download PlantUML: {}", e)))?;
    
    let bytes = response.bytes()
        .await
        .map_err(|e| PlantUMLError::RenderFailed(format!("Failed to read PlantUML data: {}", e)))?;
    
    fs::write(&target_path, bytes)?;
    
    Ok(())
}