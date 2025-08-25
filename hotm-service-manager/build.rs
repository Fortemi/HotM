//! Build script for HotM Service Manager
//! 
//! Configures Windows-specific build settings and resources.

#[cfg(windows)]
fn main() {
    // Set up Windows resource compilation
    let mut res = winres::WindowsResource::new();
    
    res.set_icon("../hotm-unified/icons/icon.ico")
        .set_language(winapi::um::winnt::MAKELANGID(
            winapi::um::winnt::LANG_ENGLISH,
            winapi::um::winnt::SUBLANG_ENGLISH_US,
        ))
        .set("FileVersion", env!("CARGO_PKG_VERSION"))
        .set("ProductVersion", env!("CARGO_PKG_VERSION"))
        .set("CompanyName", "HotM Team")
        .set("FileDescription", "HotM Windows Service Manager")
        .set("ProductName", "Hall of the Mind Service Manager")
        .set("OriginalFilename", "hotm-service-manager.exe")
        .set("InternalName", "hotm-service-manager")
        .set("LegalCopyright", "Copyright (c) 2024 HotM Team");
    
    if let Err(e) = res.compile() {
        eprintln!("Warning: Failed to compile Windows resources: {}", e);
    }
}

#[cfg(not(windows))]
fn main() {
    println!("cargo:warning=Windows service manager is only available on Windows");
}