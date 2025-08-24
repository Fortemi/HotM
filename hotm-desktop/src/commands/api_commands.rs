//! Tauri commands that interact with the HotM API server

use hotm_core::{NoteFull, SearchResponse, CreateNoteRequest, PutRevisedRequest};
use serde_json::Value;
use std::env;

/// Get the configured API server URL
fn get_api_url() -> String {
    env::var("HOTM_API_URL").unwrap_or_else(|_| "http://127.0.0.1:53211".to_string())
}

#[tauri::command]
pub async fn get_server_health() -> Result<Value, String> {
    let api_url = get_api_url();
    let url = format!("{}/health", api_url);
    
    reqwest::get(&url)
        .await
        .map_err(|e| format!("Failed to connect to server: {}", e))?
        .json::<Value>()
        .await
        .map_err(|e| format!("Failed to parse server response: {}", e))
}

#[tauri::command]
pub async fn create_note(request: CreateNoteRequest) -> Result<NoteFull, String> {
    let api_url = get_api_url();
    let url = format!("{}/api/v1/notes", api_url);
    
    let client = reqwest::Client::new();
    client
        .post(&url)
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("Failed to create note: {}", e))?
        .json::<NoteFull>()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))
}

#[tauri::command]
pub async fn get_note(id: String) -> Result<NoteFull, String> {
    let api_url = get_api_url();
    let url = format!("{}/api/v1/notes/{}", api_url, id);
    
    reqwest::get(&url)
        .await
        .map_err(|e| format!("Failed to get note: {}", e))?
        .json::<NoteFull>()
        .await
        .map_err(|e| format!("Failed to parse note response: {}", e))
}

#[tauri::command]
pub async fn update_note(id: String, update: PutRevisedRequest) -> Result<NoteFull, String> {
    let api_url = get_api_url();
    let url = format!("{}/api/v1/notes/{}", api_url, id);
    
    let client = reqwest::Client::new();
    client
        .put(&url)
        .json(&update)
        .send()
        .await
        .map_err(|e| format!("Failed to update note: {}", e))?
        .json::<NoteFull>()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))
}

#[tauri::command]
pub async fn delete_note(id: String) -> Result<(), String> {
    let api_url = get_api_url();
    let url = format!("{}/api/v1/notes/{}", api_url, id);
    
    let client = reqwest::Client::new();
    let response = client
        .delete(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to delete note: {}", e))?;
    
    if response.status().is_success() {
        Ok(())
    } else {
        Err(format!("Failed to delete note: HTTP {}", response.status()))
    }
}

#[tauri::command]
pub async fn search_notes(query: String, limit: Option<i32>) -> Result<SearchResponse, String> {
    let api_url = get_api_url();
    let url = format!("{}/api/v1/search?q={}&limit={}", api_url, 
                     urlencoding::encode(&query), 
                     limit.unwrap_or(20));
    
    reqwest::get(&url)
        .await
        .map_err(|e| format!("Failed to search notes: {}", e))?
        .json::<SearchResponse>()
        .await
        .map_err(|e| format!("Failed to parse search response: {}", e))
}

#[tauri::command]
pub async fn semantic_search(query: String, limit: Option<i32>) -> Result<SearchResponse, String> {
    let api_url = get_api_url();
    let url = format!("{}/api/v1/semantic?q={}&limit={}", api_url, 
                     urlencoding::encode(&query), 
                     limit.unwrap_or(10));
    
    reqwest::get(&url)
        .await
        .map_err(|e| format!("Failed to perform semantic search: {}", e))?
        .json::<SearchResponse>()
        .await
        .map_err(|e| format!("Failed to parse search response: {}", e))
}

#[tauri::command]
pub async fn get_note_provenance(id: String) -> Result<Value, String> {
    let api_url = get_api_url();
    let url = format!("{}/api/v1/notes/{}/provenance", api_url, id);
    
    reqwest::get(&url)
        .await
        .map_err(|e| format!("Failed to get provenance: {}", e))?
        .json::<Value>()
        .await
        .map_err(|e| format!("Failed to parse provenance response: {}", e))
}

#[tauri::command]
pub async fn set_note_tags(id: String, tags: Vec<String>) -> Result<(), String> {
    let api_url = get_api_url();
    let url = format!("{}/api/v1/notes/{}/tags", api_url, id);
    
    let client = reqwest::Client::new();
    let response = client
        .put(&url)
        .json(&tags)
        .send()
        .await
        .map_err(|e| format!("Failed to set tags: {}", e))?;
    
    if response.status().is_success() {
        Ok(())
    } else {
        Err(format!("Failed to set tags: HTTP {}", response.status()))
    }
}

#[tauri::command]
pub async fn set_note_collection(id: String, collection: String) -> Result<(), String> {
    let api_url = get_api_url();
    let url = format!("{}/api/v1/notes/{}/collection", api_url, id);
    
    let client = reqwest::Client::new();
    let response = client
        .put(&url)
        .json(&collection)
        .send()
        .await
        .map_err(|e| format!("Failed to set collection: {}", e))?;
    
    if response.status().is_success() {
        Ok(())
    } else {
        Err(format!("Failed to set collection: HTTP {}", response.status()))
    }
}