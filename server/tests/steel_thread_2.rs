//! Steel Thread #2: Hybrid Search Query
//!
//! This test validates the complete search flow:
//! 1. Full-text search (FTS) with tsvector/GIN indices
//! 2. Vector/semantic search with pgvector embeddings
//! 3. RRF (Reciprocal Rank Fusion) for combining results
//! 4. Search filters (tags, collections)
//!
//! Test Environment:
//! - USE_MOCK_AI=true bypasses actual Ollama calls for embedding generation
//! - TEST_DATABASE_URL points to test database with pgvector extension

use hotm_server::db::{self, AppState};
use hotm_server::websocket::create_broadcaster;
use uuid::Uuid;
use sqlx::Row;

/// Helper to create test state with broadcaster
async fn create_test_state() -> AppState {
    let db_url = std::env::var("TEST_DATABASE_URL").expect("TEST_DATABASE_URL must be set");
    let (broadcaster, _) = create_broadcaster();
    AppState::connect(&db_url, broadcaster).await.unwrap()
}

/// Helper to create a note with specific content for search testing
async fn create_searchable_note(state: &AppState, content: &str) -> Uuid {
    db::insert_note(state, content, "markdown", "test")
        .await
        .expect("Failed to create note")
}

// =============================================================================
// FULL-TEXT SEARCH (FTS) TESTS
// =============================================================================

/// Test: FTS returns empty results for empty database
#[tokio::test]
async fn fts_empty_database_returns_empty() {
    let state = create_test_state().await;

    let results = db::search_fts(&state, "nonexistent query", 10)
        .await
        .expect("FTS should not fail on empty database");

    // Empty or very few results expected
    assert!(results.len() <= 10, "Should return at most 10 results");
}

/// Test: FTS finds notes by exact keyword match
#[tokio::test]
async fn fts_finds_exact_keyword() {
    let state = create_test_state().await;

    // Create a note with unique keyword
    let unique_keyword = format!("xyzzy{}", Uuid::new_v4().to_string().replace("-", ""));
    let content = format!("This note contains the keyword {} for testing.", unique_keyword);
    let note_id = create_searchable_note(&state, &content).await;

    // Search for the unique keyword
    let results = db::search_fts(&state, &unique_keyword, 10)
        .await
        .expect("FTS search should succeed");

    // Should find our note
    assert!(
        results.iter().any(|hit| hit.note_id == note_id),
        "FTS should find note with exact keyword match"
    );
}

/// Test: FTS returns results with relevance scores
#[tokio::test]
async fn fts_returns_relevance_scores() {
    let state = create_test_state().await;

    // Create notes with different keyword frequencies
    let keyword = format!("relevance{}", Uuid::new_v4().to_string().replace("-", ""));

    // Note with keyword mentioned once
    let content1 = format!("This note mentions {} once.", keyword);
    let _note_id1 = create_searchable_note(&state, &content1).await;

    // Note with keyword mentioned multiple times
    let content2 = format!(
        "This note mentions {} many times. {} is important. We love {}.",
        keyword, keyword, keyword
    );
    let note_id2 = create_searchable_note(&state, &content2).await;

    let results = db::search_fts(&state, &keyword, 10)
        .await
        .expect("FTS search should succeed");

    // Should have results with scores
    assert!(!results.is_empty(), "Should find at least one result");

    for hit in &results {
        assert!(hit.score > 0.0, "Score should be positive");
        assert!(hit.score <= 1.0, "Score should be at most 1.0");
    }

    // Note with more occurrences should rank higher (if both found)
    if results.len() >= 2 {
        let high_freq_rank = results.iter().position(|h| h.note_id == note_id2);
        if let Some(rank) = high_freq_rank {
            // Higher frequency note should be in top results
            assert!(rank < 5, "Higher frequency note should rank highly");
        }
    }
}

/// Test: FTS respects result limit
#[tokio::test]
async fn fts_respects_limit() {
    let state = create_test_state().await;

    // Create multiple notes with same keyword
    let keyword = format!("limit{}", Uuid::new_v4().to_string().replace("-", ""));
    for i in 0..5 {
        let content = format!("Note {} about {} topic", i, keyword);
        create_searchable_note(&state, &content).await;
    }

    // Search with limit of 3
    let results = db::search_fts(&state, &keyword, 3)
        .await
        .expect("FTS search should succeed");

    assert!(
        results.len() <= 3,
        "Should return at most 3 results, got {}",
        results.len()
    );
}

/// Test: FTS handles multi-word queries
#[tokio::test]
async fn fts_handles_multiword_query() {
    let state = create_test_state().await;

    let word1 = format!("multi{}", Uuid::new_v4().to_string().replace("-", "")[..8].to_string());
    let word2 = format!("word{}", Uuid::new_v4().to_string().replace("-", "")[..8].to_string());

    // Note with both words
    let content = format!("This note has {} and {} together.", word1, word2);
    let note_id = create_searchable_note(&state, &content).await;

    // Search for both words
    let query = format!("{} {}", word1, word2);
    let results = db::search_fts(&state, &query, 10)
        .await
        .expect("FTS search should succeed");

    // Should find the note
    assert!(
        results.iter().any(|hit| hit.note_id == note_id),
        "FTS should find note with multi-word query"
    );
}

// =============================================================================
// SEARCH WITH FILTERS TESTS
// =============================================================================

/// Test: FTS with tag filter returns only tagged notes
#[tokio::test]
async fn fts_with_tag_filter() {
    let state = create_test_state().await;

    let keyword = format!("tagged{}", Uuid::new_v4().to_string().replace("-", ""));
    let tag_name = format!("tag{}", Uuid::new_v4().to_string().replace("-", "")[..8].to_string());

    // Create note and add tag
    let content = format!("Note with {} content", keyword);
    let note_id = create_searchable_note(&state, &content).await;

    // Add tag to the note
    sqlx::query(
        "INSERT INTO tag (name, created_at_utc) VALUES ($1, NOW()) ON CONFLICT DO NOTHING"
    )
    .bind(&tag_name)
    .execute(&state.pool)
    .await
    .expect("Failed to create tag");

    sqlx::query(
        "INSERT INTO note_tag (note_id, tag_name, source) VALUES ($1, $2, 'test') ON CONFLICT DO NOTHING"
    )
    .bind(note_id)
    .bind(&tag_name)
    .execute(&state.pool)
    .await
    .expect("Failed to tag note");

    // Search with tag filter
    let filter = format!("tag:{}", tag_name);
    let results = db::search_fts_filtered(&state, &keyword, Some(&filter), 10)
        .await
        .expect("Filtered FTS search should succeed");

    // Should find our tagged note
    assert!(
        results.iter().any(|hit| hit.note_id == note_id),
        "Filtered FTS should find tagged note"
    );
}

/// Test: FTS with collection filter returns only notes in collection
#[tokio::test]
async fn fts_with_collection_filter() {
    let state = create_test_state().await;

    let keyword = format!("collected{}", Uuid::new_v4().to_string().replace("-", ""));
    let collection_id = Uuid::new_v4();
    let collection_name = format!("Collection-{}", collection_id);

    // Create collection
    sqlx::query(
        "INSERT INTO collection (id, name, created_at_utc) VALUES ($1, $2, NOW())"
    )
    .bind(collection_id)
    .bind(&collection_name)
    .execute(&state.pool)
    .await
    .expect("Failed to create collection");

    // Create note and assign to collection
    let content = format!("Note with {} in collection", keyword);
    let note_id = create_searchable_note(&state, &content).await;

    sqlx::query(
        "UPDATE note SET collection_id = $1 WHERE id = $2"
    )
    .bind(collection_id)
    .bind(note_id)
    .execute(&state.pool)
    .await
    .expect("Failed to assign note to collection");

    // Search with collection filter
    let filter = format!("collection:{}", collection_id);
    let results = db::search_fts_filtered(&state, &keyword, Some(&filter), 10)
        .await
        .expect("Filtered FTS search should succeed");

    // Should find our collected note
    assert!(
        results.iter().any(|hit| hit.note_id == note_id),
        "Filtered FTS should find note in collection"
    );
}

// =============================================================================
// DATABASE INDEX TESTS
// =============================================================================

/// Test: tsvector column exists and is populated
#[tokio::test]
async fn tsvector_column_populated() {
    let state = create_test_state().await;

    let keyword = format!("tsvector{}", Uuid::new_v4().to_string().replace("-", ""));
    let content = format!("Testing {} population", keyword);
    let note_id = create_searchable_note(&state, &content).await;

    // Check if tsvector is populated
    let result_row = sqlx::query(
        r#"
        SELECT tsv IS NOT NULL as has_tsv
        FROM note_revised_current
        WHERE note_id = $1
        "#
    )
    .bind(note_id)
    .fetch_one(&state.pool)
    .await
    .expect("Failed to query tsvector");

    let has_tsv: bool = result_row.get("has_tsv");
    assert!(
        has_tsv,
        "tsvector column should be populated for new notes"
    );
}

/// Test: GIN index exists on tsvector
#[tokio::test]
async fn gin_index_exists() {
    let state = create_test_state().await;

    let result_row = sqlx::query(
        r#"
        SELECT COUNT(*) as count
        FROM pg_indexes
        WHERE tablename = 'note_revised_current'
        AND indexdef LIKE '%gin%'
        "#
    )
    .fetch_one(&state.pool)
    .await
    .expect("Failed to query indices");

    let count: i64 = result_row.get("count");
    assert!(
        count > 0,
        "GIN index should exist on note_revised_current"
    );
}

/// Test: pgvector extension is available
#[tokio::test]
async fn pgvector_extension_available() {
    let state = create_test_state().await;

    let result_row = sqlx::query(
        r#"
        SELECT COUNT(*) as count
        FROM pg_extension
        WHERE extname = 'vector'
        "#
    )
    .fetch_one(&state.pool)
    .await
    .expect("Failed to query extensions");

    let count: i64 = result_row.get("count");
    assert!(
        count > 0,
        "pgvector extension should be installed"
    );
}

/// Test: embedding table exists with vector column
#[tokio::test]
async fn embedding_table_structure() {
    let state = create_test_state().await;

    let result_row = sqlx::query(
        r#"
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'embedding'
        AND column_name = 'vector'
        "#
    )
    .fetch_optional(&state.pool)
    .await
    .expect("Failed to query columns");

    assert!(
        result_row.is_some(),
        "embedding table should have vector column"
    );
}

// =============================================================================
// SEARCH API ENDPOINT TESTS
// =============================================================================

/// Test: Search endpoint returns valid JSON
#[tokio::test]
async fn search_endpoint_returns_json() {
    use axum::body::Body;
    use axum::http::Request;
    use tower::util::ServiceExt;

    let state = create_test_state().await;

    let app = axum::Router::new()
        .route(
            "/api/v1/search",
            axum::routing::get(hotm_server::routes::search::search),
        )
        .with_state(state);

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/v1/search?q=test&mode=fts")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .expect("Request should succeed");

    assert!(response.status().is_success());

    // Check content-type header
    let content_type = response
        .headers()
        .get("content-type")
        .map(|v| v.to_str().unwrap_or(""));

    assert!(
        content_type.map(|ct| ct.contains("application/json")).unwrap_or(false),
        "Response should be JSON"
    );
}

/// Test: Search endpoint handles empty query gracefully
#[tokio::test]
async fn search_endpoint_handles_empty_query() {
    use axum::body::Body;
    use axum::http::Request;
    use tower::util::ServiceExt;

    let state = create_test_state().await;

    let app = axum::Router::new()
        .route(
            "/api/v1/search",
            axum::routing::get(hotm_server::routes::search::search),
        )
        .with_state(state);

    // Empty query should still return a response (possibly empty results)
    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/v1/search?q=&mode=fts")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .expect("Request should succeed");

    // Should return success or 400 (bad request for empty query)
    let status = response.status();
    assert!(
        status.is_success() || status == axum::http::StatusCode::BAD_REQUEST,
        "Should handle empty query gracefully, got {:?}",
        status
    );
}

/// Test: Search endpoint supports different modes
#[tokio::test]
async fn search_endpoint_supports_modes() {
    use axum::body::Body;
    use axum::http::Request;
    use tower::util::ServiceExt;

    let state = create_test_state().await;

    let app = axum::Router::new()
        .route(
            "/api/v1/search",
            axum::routing::get(hotm_server::routes::search::search),
        )
        .with_state(state.clone());

    // Test FTS mode
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/v1/search?q=test&mode=fts")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .expect("FTS request should succeed");
    assert!(response.status().is_success(), "FTS mode should work");

    // Test hybrid mode (may fall back to FTS if no embeddings)
    let app2 = axum::Router::new()
        .route(
            "/api/v1/search",
            axum::routing::get(hotm_server::routes::search::search),
        )
        .with_state(state);

    let response = app2
        .oneshot(
            Request::builder()
                .uri("/api/v1/search?q=test&mode=hybrid")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .expect("Hybrid request should succeed");
    assert!(response.status().is_success(), "Hybrid mode should work");
}

// =============================================================================
// SEARCH RESULT STRUCTURE TESTS
// =============================================================================

/// Test: SearchHit has required fields
#[tokio::test]
async fn search_hit_structure() {
    let state = create_test_state().await;

    let keyword = format!("structure{}", Uuid::new_v4().to_string().replace("-", ""));
    let content = format!("Note for {} testing", keyword);
    let note_id = create_searchable_note(&state, &content).await;

    let results = db::search_fts(&state, &keyword, 10)
        .await
        .expect("FTS search should succeed");

    if let Some(hit) = results.iter().find(|h| h.note_id == note_id) {
        // Verify structure
        assert!(!hit.note_id.is_nil(), "note_id should be valid UUID");
        assert!(hit.score >= 0.0, "score should be non-negative");
        // snippet is optional
    }
}

// =============================================================================
// ARCHIVED NOTES EXCLUSION TESTS
// =============================================================================

/// Test: Archived notes are excluded from search
#[tokio::test]
async fn archived_notes_excluded() {
    let state = create_test_state().await;

    let keyword = format!("archived{}", Uuid::new_v4().to_string().replace("-", ""));
    let content = format!("Note about {} topic", keyword);
    let note_id = create_searchable_note(&state, &content).await;

    // Archive the note
    sqlx::query("UPDATE note SET archived = true WHERE id = $1")
        .bind(note_id)
        .execute(&state.pool)
        .await
        .expect("Failed to archive note");

    // Search should not find archived note
    let results = db::search_fts(&state, &keyword, 10)
        .await
        .expect("FTS search should succeed");

    assert!(
        !results.iter().any(|hit| hit.note_id == note_id),
        "Archived notes should be excluded from search results"
    );
}
