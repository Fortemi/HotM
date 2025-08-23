use std::fs;
use std::path::Path;
use std::process::Command;

fn main() {
    // PlantUML is handled via external server - no JAR bundling needed
    println!("cargo:rustc-env=PLANTUML_BUNDLED=false");
    
    // Build the server binary for inclusion in installer
    build_server_for_installer();
    
    // Continue with the default Tauri build
    tauri_build::build()
}

fn build_server_for_installer() {
    println!("cargo:warning=Building server binary for installer...");
    
    let server_path = Path::new("../../server");
    if server_path.exists() {
        // Build the server in release mode
        let output = Command::new("cargo")
            .args(&["build", "--release"])
            .current_dir(server_path)
            .output()
            .expect("Failed to execute cargo build for server");
        
        if output.status.success() {
            // Copy server binary to resources for WiX
            let resources_dir = Path::new("installer/resources");
            fs::create_dir_all(resources_dir).ok();
            
            let server_exe = server_path.join("target/release/hotm-server.exe");
            let dest_exe = resources_dir.join("hotm-server.exe");
            
            if server_exe.exists() {
                if let Err(e) = fs::copy(&server_exe, &dest_exe) {
                    println!("cargo:warning=Failed to copy server binary: {}", e);
                } else {
                    println!("cargo:warning=Server binary copied to installer resources");
                }
            } else {
                println!("cargo:warning=Server binary not found at expected location");
            }
        } else {
            println!("cargo:warning=Server build failed: {}", String::from_utf8_lossy(&output.stderr));
        }
    } else {
        println!("cargo:warning=Server source not found - installer will not include server component");
    }
}
