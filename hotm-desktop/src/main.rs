//! HotM Desktop Application Entry Point

// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    hotm_desktop_lib::run()
}