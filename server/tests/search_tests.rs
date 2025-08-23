#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::StatusCode;
    use serde_json::json;

    #[tokio::test]
    async fn test_fts_search() {
        // Test full-text search
        let response = client
            .get("/api/v1/search?q=neural&mode=fts")
            .send()
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);

        let json: serde_json::Value = response.json().await.unwrap();
        assert!(json["notes"].is_array());

        let notes = json["notes"].as_array().unwrap();
        assert!(!notes.is_empty());

        // Check structure
        let first_note = &notes[0];
        assert!(first_note["note_id"].is_string());
        assert!(first_note["score"].is_number());
        assert!(first_note["snippet"].is_string());
    }

    #[tokio::test]
    async fn test_tag_filter_search() {
        // Test tag filtering
        let response = client
            .get("/api/v1/search?q=test&mode=fts&filters=tag:pytorch")
            .send()
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);

        let json: serde_json::Value = response.json().await.unwrap();
        assert!(json["notes"].is_array());
    }

    #[tokio::test]
    async fn test_semantic_search() {
        // Test semantic search
        let response = client
            .post("/api/v1/semantic")
            .json(&json!({
                "text": "machine learning with neural networks"
            }))
            .send()
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);

        let json: serde_json::Value = response.json().await.unwrap();
        assert!(json["similar"].is_array());
    }

    #[tokio::test]
    async fn test_hybrid_search() {
        // Test hybrid search
        let response = client
            .get("/api/v1/search?q=transformers&mode=hybrid")
            .send()
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);

        let json: serde_json::Value = response.json().await.unwrap();
        assert!(json["notes"].is_array());
    }

    #[tokio::test]
    async fn test_find_related_notes() {
        // First create a note
        let create_response = client
            .post("/api/v1/notes")
            .json(&json!({
                "content": "Test note about machine learning"
            }))
            .send()
            .await
            .unwrap();

        let note_id = create_response.json::<serde_json::Value>().await.unwrap()["note_id"]
            .as_str()
            .unwrap();

        // Find related notes
        let response = client
            .get(&format!("/api/v1/notes/{}/related", note_id))
            .send()
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);

        let json: serde_json::Value = response.json().await.unwrap();
        assert!(json["related"].is_array());
    }

    #[tokio::test]
    async fn test_empty_search_results() {
        // Test search with no results
        let response = client
            .get("/api/v1/search?q=xyznonexistentquery&mode=fts")
            .send()
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);

        let json: serde_json::Value = response.json().await.unwrap();
        assert!(json["notes"].is_array());
        assert_eq!(json["notes"].as_array().unwrap().len(), 0);
    }
}
