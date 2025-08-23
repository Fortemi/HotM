use reqwest;
use serde_json::{json, Value};
use uuid::Uuid;

const API_URL: &str = "http://localhost:53211/api/v1";

#[tokio::test]
async fn test_create_note() {
    let client = reqwest::Client::new();
    
    let response = client
        .post(format!("{}/notes", API_URL))
        .json(&json!({
            "content": "# Test Note\n\nThis is a test note.",
            "format": "markdown",
            "source": "test"
        }))
        .send()
        .await
        .expect("Failed to send request");
    
    assert_eq!(response.status(), 201);
    
    let body: Value = response.json().await.expect("Failed to parse JSON");
    assert!(body["note_id"].is_string(), "Should return note_id");
    
    // Verify the note_id is a valid UUID
    let note_id = body["note_id"].as_str().unwrap();
    Uuid::parse_str(note_id).expect("note_id should be a valid UUID");
}

#[tokio::test]
async fn test_get_note() {
    let client = reqwest::Client::new();
    
    // First create a note
    let create_response = client
        .post(format!("{}/notes", API_URL))
        .json(&json!({
            "content": "# Get Test\n\nNote for testing GET endpoint.",
            "format": "markdown",
            "source": "test"
        }))
        .send()
        .await
        .expect("Failed to create note");
    
    let create_body: Value = create_response.json().await.expect("Failed to parse JSON");
    let note_id = create_body["note_id"].as_str().expect("Expected note_id");
    
    // Get the note
    let get_response = client
        .get(format!("{}/notes/{}", API_URL, note_id))
        .send()
        .await
        .expect("Failed to get note");
    
    assert_eq!(get_response.status(), 200);
    
    let get_body: Value = get_response.json().await.expect("Failed to parse JSON");
    assert!(get_body["note"].is_object(), "Should have note object");
    assert!(get_body["original"].is_object(), "Should have original object");
    assert_eq!(
        get_body["note"]["id"].as_str().unwrap(),
        note_id,
        "Note ID should match"
    );
}

#[tokio::test]
async fn test_update_note_status() {
    let client = reqwest::Client::new();
    
    // Create a note
    let create_response = client
        .post(format!("{}/notes", API_URL))
        .json(&json!({
            "content": "Status test note",
            "format": "markdown",
            "source": "test"
        }))
        .send()
        .await
        .expect("Failed to create note");
    
    let create_body: Value = create_response.json().await.expect("Failed to parse JSON");
    let note_id = create_body["note_id"].as_str().expect("Expected note_id");
    
    // Update status (star the note)
    let status_response = client
        .put(format!("{}/notes/{}/status", API_URL, note_id))
        .json(&json!({
            "starred": true,
            "archived": false
        }))
        .send()
        .await
        .expect("Failed to update status");
    
    assert_eq!(status_response.status(), 200);
    
    // Verify the status was updated
    let get_response = client
        .get(format!("{}/notes/{}", API_URL, note_id))
        .send()
        .await
        .expect("Failed to get note");
    
    let get_body: Value = get_response.json().await.expect("Failed to parse JSON");
    assert_eq!(
        get_body["note"]["starred"].as_bool().unwrap(),
        true,
        "Note should be starred"
    );
}

#[tokio::test]
async fn test_delete_note() {
    let client = reqwest::Client::new();
    
    // Create a note
    let create_response = client
        .post(format!("{}/notes", API_URL))
        .json(&json!({
            "content": "Note to be deleted",
            "format": "markdown",
            "source": "test"
        }))
        .send()
        .await
        .expect("Failed to create note");
    
    let create_body: Value = create_response.json().await.expect("Failed to parse JSON");
    let note_id = create_body["note_id"].as_str().expect("Expected note_id");
    
    // Delete the note
    let delete_response = client
        .delete(format!("{}/notes/{}", API_URL, note_id))
        .send()
        .await
        .expect("Failed to delete note");
    
    assert_eq!(delete_response.status(), 200);
    
    // Verify the note is deleted (should get 404)
    let get_response = client
        .get(format!("{}/notes/{}", API_URL, note_id))
        .send()
        .await
        .expect("Failed to get note");
    
    assert_eq!(get_response.status(), 404, "Deleted note should return 404");
}

#[tokio::test]
async fn test_list_notes() {
    let client = reqwest::Client::new();
    
    // Create multiple notes
    for i in 0..3 {
        let response = client
            .post(format!("{}/notes", API_URL))
            .json(&json!({
                "content": format!("List test note {}", i),
                "format": "markdown",
                "source": "test"
            }))
            .send()
            .await
            .expect("Failed to create note");
        
        assert_eq!(response.status(), 201);
    }
    
    // List notes
    let list_response = client
        .get(format!("{}/notes?sort_by=created_at&sort_order=desc&limit=10", API_URL))
        .send()
        .await
        .expect("Failed to list notes");
    
    assert_eq!(list_response.status(), 200);
    
    let list_body: Value = list_response.json().await.expect("Failed to parse JSON");
    let notes = list_body["notes"].as_array().expect("Expected notes array");
    assert!(notes.len() >= 3, "Should have at least 3 notes");
    assert!(list_body["total"].is_number(), "Should have total count");
}

#[tokio::test]
async fn test_regenerate_ai() {
    let client = reqwest::Client::new();
    
    // Create a note
    let create_response = client
        .post(format!("{}/notes", API_URL))
        .json(&json!({
            "content": "Note for AI regeneration test",
            "format": "markdown",
            "source": "test"
        }))
        .send()
        .await
        .expect("Failed to create note");
    
    let create_body: Value = create_response.json().await.expect("Failed to parse JSON");
    let note_id = create_body["note_id"].as_str().expect("Expected note_id");
    
    // Trigger AI regeneration
    let regen_response = client
        .post(format!("{}/notes/{}/regenerate-ai", API_URL, note_id))
        .send()
        .await
        .expect("Failed to regenerate AI");
    
    assert_eq!(regen_response.status(), 200);
    
    let regen_body: Value = regen_response.json().await.expect("Failed to parse JSON");
    assert_eq!(regen_body["status"].as_str().unwrap(), "regenerating");
    assert!(regen_body["job_ids"].is_array(), "Should return job IDs");
}