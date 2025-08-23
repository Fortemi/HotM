use reqwest;
use serde_json::{json, Value};
use uuid::Uuid;

mod common;
use common::{setup_test_db, test_note_content};

const API_URL: &str = "http://localhost:53211/api/v1";

#[tokio::test]
async fn test_health_endpoint() {
    let client = reqwest::Client::new();
    let response = client
        .get(format!("{}/health", API_URL))
        .send()
        .await
        .expect("Failed to send request");
    
    assert_eq!(response.status(), 200);
    
    let body: Value = response.json().await.expect("Failed to parse JSON");
    assert_eq!(body["ok"], true);
}

#[tokio::test]
async fn test_fts_search() {
    let client = reqwest::Client::new();
    
    // First create a note with searchable content
    let note_response = client
        .post(format!("{}/notes", API_URL))
        .json(&json!({
            "content": "Neural networks are powerful machine learning models",
            "format": "markdown",
            "source": "test"
        }))
        .send()
        .await
        .expect("Failed to create note");
    
    assert_eq!(note_response.status(), 201);
    
    // Wait a bit for indexing
    tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
    
    // Search for the note
    let search_response = client
        .get(format!("{}/search?q=neural&mode=fts", API_URL))
        .send()
        .await
        .expect("Failed to search");
    
    assert_eq!(search_response.status(), 200);
    
    let search_body: Value = search_response.json().await.expect("Failed to parse JSON");
    let notes = search_body["notes"].as_array().expect("Expected notes array");
    assert!(notes.len() > 0, "FTS search should return results");
}

#[tokio::test]
async fn test_semantic_search() {
    let client = reqwest::Client::new();
    
    // Create a note
    let note_response = client
        .post(format!("{}/notes", API_URL))
        .json(&json!({
            "content": "Deep learning with transformers revolutionized NLP",
            "format": "markdown",
            "source": "test"
        }))
        .send()
        .await
        .expect("Failed to create note");
    
    assert_eq!(note_response.status(), 201);
    
    // Wait for embedding generation
    tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
    
    // Semantic search
    let search_response = client
        .post(format!("{}/semantic", API_URL))
        .json(&json!({
            "text": "natural language processing with neural networks"
        }))
        .send()
        .await
        .expect("Failed to perform semantic search");
    
    assert_eq!(search_response.status(), 200);
    
    let search_body: Value = search_response.json().await.expect("Failed to parse JSON");
    let similar = search_body["similar"].as_array().expect("Expected similar array");
    assert!(similar.len() > 0, "Semantic search should return results");
}

#[tokio::test]
async fn test_hybrid_search() {
    let client = reqwest::Client::new();
    
    // Create test notes
    let note1 = client
        .post(format!("{}/notes", API_URL))
        .json(&json!({
            "content": "Machine learning algorithms include decision trees",
            "format": "markdown",
            "source": "test"
        }))
        .send()
        .await
        .expect("Failed to create note 1");
    
    assert_eq!(note1.status(), 201);
    
    let note2 = client
        .post(format!("{}/notes", API_URL))
        .json(&json!({
            "content": "Random forests are ensemble learning methods",
            "format": "markdown",
            "source": "test"
        }))
        .send()
        .await
        .expect("Failed to create note 2");
    
    assert_eq!(note2.status(), 201);
    
    // Wait for processing
    tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
    
    // Hybrid search
    let search_response = client
        .get(format!("{}/search?q=learning&mode=hybrid", API_URL))
        .send()
        .await
        .expect("Failed to perform hybrid search");
    
    assert_eq!(search_response.status(), 200);
    
    let search_body: Value = search_response.json().await.expect("Failed to parse JSON");
    let notes = search_body["notes"].as_array().expect("Expected notes array");
    assert!(notes.len() > 0, "Hybrid search should return results");
}

#[tokio::test]
async fn test_tag_filtering() {
    let client = reqwest::Client::new();
    
    // Create a note
    let note_response = client
        .post(format!("{}/notes", API_URL))
        .json(&json!({
            "content": "Test note for tag filtering",
            "format": "markdown",
            "source": "test"
        }))
        .send()
        .await
        .expect("Failed to create note");
    
    assert_eq!(note_response.status(), 201);
    let note_body: Value = note_response.json().await.expect("Failed to parse JSON");
    let note_id = note_body["note_id"].as_str().expect("Expected note_id");
    
    // Add tags
    let tag_response = client
        .put(format!("{}/notes/{}/tags", API_URL, note_id))
        .json(&json!({
            "add": ["test-tag", "integration"],
            "remove": []
        }))
        .send()
        .await
        .expect("Failed to add tags");
    
    assert_eq!(tag_response.status(), 200);
    
    // Search with tag filter
    let search_response = client
        .get(format!("{}/search?q=test&mode=fts&filters=tag:test-tag", API_URL))
        .send()
        .await
        .expect("Failed to search with tag filter");
    
    assert_eq!(search_response.status(), 200);
    
    let search_body: Value = search_response.json().await.expect("Failed to parse JSON");
    let notes = search_body["notes"].as_array().expect("Expected notes array");
    assert!(notes.len() > 0, "Tag filter should return results");
}