use std::fs;
use std::path::Path;

fn main() {
    // PlantUML is handled via external server - no JAR bundling needed
    println!("cargo:rustc-env=PLANTUML_BUNDLED=false");
    
    // Continue with the default Tauri build
    tauri_build::build()
}
