#[cfg(test)]
mod tests {
    use hotm_server::db::{fetch_note, insert_note, AppState};
    use std::time::Duration;
    use tokio::time::sleep;

    #[tokio::test]
    async fn test_ai_revision_generation() {
        // Setup test database
        let database_url = std::env::var("TEST_DATABASE_URL").unwrap_or_else(|_| {
            std::env::var("DATABASE_URL").expect("DATABASE_URL must be set for tests")
        });

        let (broadcaster, _) = hotm_server::websocket::create_broadcaster();
        let state = AppState::connect(&database_url, broadcaster)
            .await
            .expect("Failed to connect to database");

        // Create a test note
        let test_content =
            "This is a test note for AI revision testing. It should be enhanced with markdown.";
        let note_id = insert_note(&state, test_content, "text", "test")
            .await
            .expect("Failed to insert test note");

        println!("Created test note: {}", note_id);

        // Wait for AI revision to be generated (async process)
        println!("Waiting for AI revision generation...");
        sleep(Duration::from_secs(10)).await;

        // Fetch the note with revision
        let note_full = fetch_note(&state, note_id)
            .await
            .expect("Failed to fetch note");

        // Verify original content is preserved
        assert_eq!(
            note_full.original.content, test_content,
            "Original content should be preserved"
        );

        // Check if revision was generated
        let revised = &note_full.revised;
        println!("AI Revision generated successfully!");
        println!("Original: {}", test_content);
        println!("Revised: {}", revised.content);

        // Verify revision is different from original (AI enhanced it)
        assert_ne!(
            revised.content, test_content,
            "Revised content should be different from original"
        );

        // Check for markdown formatting (AI should add this)
        let has_markdown = revised.content.contains("#")
            || revised.content.contains("**")
            || revised.content.contains("*")
            || revised.content.contains("-");
        assert!(
            has_markdown,
            "AI revision should contain markdown formatting"
        );
    }

    #[tokio::test]
    async fn test_embedding_generation() {
        let database_url = std::env::var("TEST_DATABASE_URL").unwrap_or_else(|_| {
            std::env::var("DATABASE_URL").expect("DATABASE_URL must be set for tests")
        });

        let (broadcaster, _) = hotm_server::websocket::create_broadcaster();
        let state = AppState::connect(&database_url, broadcaster)
            .await
            .expect("Failed to connect to database");

        // Create a test note
        let test_content = "Machine learning is a subset of artificial intelligence.";
        let note_id = insert_note(&state, test_content, "text", "test")
            .await
            .expect("Failed to insert test note");

        // Wait for embeddings to be generated
        sleep(Duration::from_secs(5)).await;

        // Query for embeddings
        let embeddings = sqlx::query!(
            "SELECT COUNT(*) as count FROM embedding WHERE note_id = $1",
            note_id
        )
        .fetch_one(&state.pool)
        .await
        .expect("Failed to query embeddings");

        assert!(
            embeddings.count.unwrap_or(0) > 0,
            "Embeddings should be generated for the note"
        );
    }
}
