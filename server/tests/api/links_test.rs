use reqwest;
use serde_json::{json, Value};

const API_URL: &str = "http://localhost:53211/api/v1";

#[tokio::test]
async fn test_create_manual_link() {
    let client = reqwest::Client::new();
    
    // Create two notes
    let note1_response = client
        .post(format!("{}/notes", API_URL))
        .json(&json!({
            "content": "First note for linking",
            "format": "markdown",
            "source": "test"
        }))
        .send()
        .await
        .expect("Failed to create note 1");
    
    let note1_body: Value = note1_response.json().await.expect("Failed to parse JSON");
    let note1_id = note1_body["note_id"].as_str().expect("Expected note_id");
    
    let note2_response = client
        .post(format!("{}/notes", API_URL))
        .json(&json!({
            "content": "Second note for linking",
            "format": "markdown",
            "source": "test"
        }))
        .send()
        .await
        .expect("Failed to create note 2");
    
    let note2_body: Value = note2_response.json().await.expect("Failed to parse JSON");
    let note2_id = note2_body["note_id"].as_str().expect("Expected note_id");
    
    // Create link between notes
    let link_response = client
        .post(format!("{}/notes/{}/links", API_URL, note1_id))
        .json(&json!({
            "to_note_id": note2_id
        }))
        .send()
        .await
        .expect("Failed to create link");
    
    assert_eq!(link_response.status(), 201);
    
    let link_body: Value = link_response.json().await.expect("Failed to parse JSON");
    assert_eq!(link_body["status"].as_str().unwrap(), "created");
    assert!(link_body["link_id"].is_string(), "Should return link_id");
    
    // Verify the link exists
    let get_response = client
        .get(format!("{}/notes/{}", API_URL, note1_id))
        .send()
        .await
        .expect("Failed to get note");
    
    let get_body: Value = get_response.json().await.expect("Failed to parse JSON");
    let links = get_body["links"].as_array().expect("Expected links array");
    
    // Find the manual link we created
    let manual_link = links.iter().find(|link| {
        link["to_note_id"].as_str() == Some(note2_id) &&
        link["kind"].as_str() == Some("manual")
    });
    
    assert!(manual_link.is_some(), "Manual link should exist");
}

#[tokio::test]
async fn test_get_related_notes() {
    let client = reqwest::Client::new();
    
    // Create a note with some content
    let note_response = client
        .post(format!("{}/notes", API_URL))
        .json(&json!({
            "content": "Machine learning and neural networks are transforming AI",
            "format": "markdown",
            "source": "test"
        }))
        .send()
        .await
        .expect("Failed to create note");
    
    let note_body: Value = note_response.json().await.expect("Failed to parse JSON");
    let note_id = note_body["note_id"].as_str().expect("Expected note_id");
    
    // Create related notes
    for i in 0..2 {
        let response = client
            .post(format!("{}/notes", API_URL))
            .json(&json!({
                "content": format!("Related note {} about deep learning and AI", i),
                "format": "markdown",
                "source": "test"
            }))
            .send()
            .await
            .expect("Failed to create related note");
        
        assert_eq!(response.status(), 201);
    }
    
    // Wait for processing and linking
    tokio::time::sleep(tokio::time::Duration::from_secs(10)).await;
    
    // Get related notes
    let related_response = client
        .get(format!("{}/notes/{}/related", API_URL, note_id))
        .send()
        .await
        .expect("Failed to get related notes");
    
    assert_eq!(related_response.status(), 200);
    
    let related_body: Value = related_response.json().await.expect("Failed to parse JSON");
    assert!(related_body["related"].is_array(), "Should have related array");
    assert!(related_body["context_summary"].is_string(), "Should have context summary");
}

#[tokio::test]
async fn test_keyword_links_with_metadata() {
    let client = reqwest::Client::new();
    
    // Create notes with matching keywords
    let note1_response = client
        .post(format!("{}/notes", API_URL))
        .json(&json!({
            "content": "This note discusses Rust programming and async functions",
            "format": "markdown",
            "source": "test"
        }))
        .send()
        .await
        .expect("Failed to create note 1");
    
    let note1_body: Value = note1_response.json().await.expect("Failed to parse JSON");
    let note1_id = note1_body["note_id"].as_str().expect("Expected note_id");
    
    let note2_response = client
        .post(format!("{}/notes", API_URL))
        .json(&json!({
            "content": "Another note about Rust and async programming patterns",
            "format": "markdown",
            "source": "test"
        }))
        .send()
        .await
        .expect("Failed to create note 2");
    
    let note2_body: Value = note2_response.json().await.expect("Failed to parse JSON");
    let note2_id = note2_body["note_id"].as_str().expect("Expected note_id");
    
    // Wait for AI processing and linking
    tokio::time::sleep(tokio::time::Duration::from_secs(15)).await;
    
    // Get the first note with its links
    let get_response = client
        .get(format!("{}/notes/{}", API_URL, note1_id))
        .send()
        .await
        .expect("Failed to get note");
    
    let get_body: Value = get_response.json().await.expect("Failed to parse JSON");
    let links = get_body["links"].as_array().expect("Expected links array");
    
    // Find keyword links
    let keyword_links: Vec<&Value> = links.iter()
        .filter(|link| link["kind"].as_str() == Some("keyword"))
        .collect();
    
    assert!(!keyword_links.is_empty(), "Should have keyword links");
    
    // Check that keyword links have metadata
    for link in keyword_links {
        assert!(link["metadata"].is_object(), "Keyword link should have metadata");
        let metadata = &link["metadata"];
        assert!(metadata["keywords"].is_array(), "Metadata should have keywords array");
        
        let keywords = metadata["keywords"].as_array().unwrap();
        assert!(!keywords.is_empty(), "Keywords array should not be empty");
    }
}