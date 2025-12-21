use std::fs;
use std::path::Path;
use std::process::Command;

fn main() {
    // PlantUML is handled via external server - no JAR bundling needed
    println!("cargo:rustc-env=PLANTUML_BUNDLED=false");

    // Build the server binary for inclusion in installer
    build_server_for_installer();

    // Copy schema file to resources
    copy_schema_to_resources();

    // Note: PostgreSQL binaries should be pre-downloaded to installer/resources/postgres/
    // Use scripts/download-postgres.ps1 to set up before building installer
    check_postgres_resources();

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

fn copy_schema_to_resources() {
    let schema_src = Path::new("../../scripts/schema/clean-schema.sql");
    let resources_dir = Path::new("installer/resources");
    fs::create_dir_all(resources_dir).ok();

    if schema_src.exists() {
        let dest = resources_dir.join("clean-schema.sql");
        if let Err(e) = fs::copy(schema_src, &dest) {
            println!("cargo:warning=Failed to copy schema file: {}", e);
        } else {
            println!("cargo:warning=Schema file copied to installer resources");
        }
    } else {
        println!("cargo:warning=Schema file not found at {:?}", schema_src);
    }
}

fn check_postgres_resources() {
    // HotM uses Docker for PostgreSQL setup (pgvector/pgvector:pg16 image)
    // The installer includes setup-postgres.ps1 which runs Docker setup
    let setup_script = Path::new("installer/resources/setup-postgres.ps1");

    if !setup_script.exists() {
        println!("cargo:warning===========================================");
        println!("cargo:warning=setup-postgres.ps1 not found in installer/resources/");
        println!("cargo:warning=This script is needed for Docker-based PostgreSQL setup.");
        println!("cargo:warning===========================================");
    } else {
        println!("cargo:warning=PostgreSQL setup script found - Docker-based setup will be available");
    }
}
