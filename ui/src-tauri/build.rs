use std::fs;
use std::path::Path;

fn main() {
    // Check if PlantUML JAR exists and handle it
    let plantuml_path = Path::new("resources/plantuml.jar");
    
    if plantuml_path.exists() {
        println!("cargo:rustc-env=PLANTUML_BUNDLED=true");
        println!("cargo:warning=PlantUML JAR found - will be bundled with the application");
    } else {
        println!("cargo:rustc-env=PLANTUML_BUNDLED=false");
        println!("cargo:warning=PlantUML JAR not found - PlantUML support will require manual setup");
    }
    
    // Continue with the default Tauri build
    tauri_build::build()
}
