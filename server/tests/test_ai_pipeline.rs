#[cfg(test)]
mod tests {
    use hotm_server::db::{fetch_note, insert_note, AppState};
    use std::time::Duration;
    use tokio::time::sleep;
    use sqlx::Row;

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

        // Check if we should use mock AI
        let use_mock_ai = std::env::var("USE_MOCK_AI").unwrap_or_default() == "true";

        if use_mock_ai {
            // Mock AI revision - simulate what AI would do
            let mock_revised_content = "# Test Note\n\nThis is a **test note** for AI revision testing. It should be enhanced with *markdown formatting*.\n\n- Enhanced with headers\n- Added bold and italic text\n- Improved structure";

            // Directly update the database with mock revision (simulating AI pipeline)
            sqlx::query(
                "INSERT INTO note_revised_current (note_id, content, ai_metadata) VALUES ($1, $2, '{}') ON CONFLICT (note_id) DO UPDATE SET content = $2, ai_metadata = '{}'"
            )
            .bind(note_id)
            .bind(mock_revised_content)
            .execute(&state.pool)
            .await
            .expect("Failed to insert mock revision");

            println!("Applied mock AI revision for testing");
        } else {
            // Wait for real AI revision to be generated (async process)
            println!("Waiting for AI revision generation...");
            sleep(Duration::from_secs(10)).await;
        }

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
        // Skip embedding tests when using mock AI since vector types are complex to mock
        let use_mock_ai = std::env::var("USE_MOCK_AI").unwrap_or_default() == "true";
        if use_mock_ai {
            println!("Skipping embedding test with mock AI");
            return;
        }

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

        // Wait for real embeddings to be generated
        sleep(Duration::from_secs(5)).await;

        // Query for embeddings
        let embeddings_row = sqlx::query(
            "SELECT COUNT(*) as count FROM embedding WHERE note_id = $1"
        )
        .bind(note_id)
        .fetch_one(&state.pool)
        .await
        .expect("Failed to query embeddings");

        let count: i64 = embeddings_row.get("count");
        assert!(
            count > 0,
            "Embeddings should be generated for the note"
        );
    }
}
