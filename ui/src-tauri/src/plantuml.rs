use std::process::{Command, Stdio};
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
        // Development: In src-tauri/resources directory
        std::env::current_dir()
            .ok()
            .map(|p| p.join("resources").join("plantuml.jar")),
        // Production: In the app's resource directory
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
        // In a resources subdirectory relative to executable
        std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|d| d.join("resources").join("plantuml.jar"))),
        // In a libs subdirectory
        std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|d| d.join("libs").join("plantuml.jar"))),
    ];

    eprintln!("PlantUML: Searching for JAR file...");
    for path_opt in possible_paths {
        if let Some(path) = path_opt {
            eprintln!("PlantUML: Checking path: {:?}", path);
            if path.exists() {
                eprintln!("PlantUML: Found JAR at: {:?}", path);
                return Ok(path);
            }
        }
    }

    eprintln!("PlantUML: JAR not found in any expected location");
    Err(PlantUMLError::PlantUMLJarNotFound)
}

/// Check if Java is available
fn check_java() -> Result<(), PlantUMLError> {
    let mut cmd = Command::new("java");
    cmd.arg("-version")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    
    // Hide console window on Windows
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    
    let output = cmd.output();

    match output {
        Ok(o) if o.status.success() => Ok(()),
        _ => Err(PlantUMLError::JavaNotFound),
    }
}

/// Render PlantUML code to SVG
pub fn render_plantuml(app: &AppHandle, code: &str) -> Result<String, PlantUMLError> {
    // Check Java availability
    check_java()?;
    
    // Get PlantUML JAR path, or download if not present
    let jar_path = match get_plantuml_jar_path(app) {
        Ok(path) => path,
        Err(_) => {
            // Try to download PlantUML JAR
            // For now, return an error suggesting the user needs to install PlantUML
            return Err(PlantUMLError::PlantUMLJarNotFound);
        }
    };
    
    // Create temporary directory for input/output with timestamp for uniqueness
    let temp_dir = std::env::temp_dir();
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let input_file = temp_dir.join(format!("plantuml_input_{}_{}.puml", 
        std::process::id(), timestamp));
    let output_file = temp_dir.join(format!("plantuml_input_{}_{}.svg", 
        std::process::id(), timestamp));
    
    // Write PlantUML code to temporary file
    fs::write(&input_file, code)?;
    
    // Log for debugging
    eprintln!("PlantUML: Processing diagram with JAR: {:?}", jar_path);
    eprintln!("PlantUML: Input file: {:?}", input_file);
    eprintln!("PlantUML: Output directory: {:?}", temp_dir);
    
    // Run PlantUML with explicit output directory
    let mut cmd = Command::new("java");
    cmd.arg("-jar")
        .arg(&jar_path)
        .arg("-tsvg")
        .arg("-charset")
        .arg("UTF-8")
        .arg("-o")
        .arg(&temp_dir)  // Explicit output directory
        .arg(&input_file)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    
    // Hide console window on Windows
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    
    let output = cmd.output()?;
    
    // Clean up input file
    let _ = fs::remove_file(&input_file);
    
    if !output.status.success() {
        let error_msg = String::from_utf8_lossy(&output.stderr);
        let stdout_msg = String::from_utf8_lossy(&output.stdout);
        eprintln!("PlantUML: Command failed with stderr: {}", error_msg);
        eprintln!("PlantUML: stdout: {}", stdout_msg);
        return Err(PlantUMLError::RenderFailed(
            format!("stderr: {}\nstdout: {}", error_msg, stdout_msg)
        ));
    }
    
    // PlantUML might create output file with slightly different name
    // Try the expected file first
    let svg = if output_file.exists() {
        eprintln!("PlantUML: Found output file at expected location: {:?}", output_file);
        let content = fs::read_to_string(&output_file)?;
        let _ = fs::remove_file(&output_file);
        content
    } else {
        // Try alternative naming (PlantUML sometimes removes underscores or changes names)
        let alt_output = temp_dir.join(format!("plantuml_input_{}_{}.svg", 
            std::process::id(), timestamp).replace("_", ""));
        
        if alt_output.exists() {
            eprintln!("PlantUML: Found output at alternative location: {:?}", alt_output);
            let content = fs::read_to_string(&alt_output)?;
            let _ = fs::remove_file(&alt_output);
            content
        } else {
            // List all files in temp dir for debugging
            eprintln!("PlantUML: Output file not found. Checking directory contents...");
            if let Ok(entries) = fs::read_dir(&temp_dir) {
                for entry in entries {
                    if let Ok(entry) = entry {
                        eprintln!("  Found file: {:?}", entry.path());
                    }
                }
            }
            return Err(PlantUMLError::RenderFailed(
                format!("SVG file not generated. Expected: {:?}", output_file)
            ));
        }
    };
    
    Ok(svg)
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