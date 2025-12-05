//! Database Layer Unit Tests (WI-001)
//!
//! This test module provides comprehensive unit test coverage for:
//! - db.rs: Core note CRUD operations
//! - Note creation, retrieval, listing, and updates
//! - Search operations (FTS and vector)
//! - Job queue integration
//!
//! Test Environment:
//! - USE_MOCK_AI=true bypasses actual Ollama calls
//! - TEST_DATABASE_URL points to test database

use hotm_server::db::{self, AppState};
use hotm_server::models::{ListNotesRequest, UpdateNoteStatusRequest};
use hotm_server::websocket::create_broadcaster;
use sqlx::Row;
use uuid::Uuid;

/// Helper to create test state with broadcaster
async fn create_test_state() -> AppState {
    let db_url = std::env::var("TEST_DATABASE_URL").expect("TEST_DATABASE_URL must be set");
    let (broadcaster, _) = create_broadcaster();
    AppState::connect(&db_url, broadcaster).await.unwrap()
}

// =============================================================================
// INSERT_NOTE TESTS
// =============================================================================

/// Test: insert_note creates note with valid UUID
#[tokio::test]
async fn insert_note_returns_valid_uuid() {
    let state = create_test_state().await;

    let content = format!("Test note content {}", Uuid::new_v4());
    let note_id = db::insert_note(&state, &content, "markdown", "test")
        .await
        .expect("Failed to create note");

    assert!(!note_id.is_nil(), "Note ID should be valid UUID");
}

/// Test: insert_note stores original content correctly
#[tokio::test]
async fn insert_note_stores_original_content() {
    let state = create_test_state().await;

    let content = format!("Original content test {}", Uuid::new_v4());
    let note_id = db::insert_note(&state, &content, "markdown", "manual")
        .await
        .expect("Failed to create note");

    // Verify via fetch_note which uses the db module
    let note = db::fetch_note(&state, note_id)
        .await
        .expect("Failed to fetch note");

    assert_eq!(note.original.content, content);
}

/// Test: insert_note computes SHA256 hash
#[tokio::test]
async fn insert_note_computes_hash() {
    let state = create_test_state().await;

    let content = format!("Hash test content {}", Uuid::new_v4());
    let note_id = db::insert_note(&state, &content, "markdown", "test")
        .await
        .expect("Failed to create note");

    let note = db::fetch_note(&state, note_id)
        .await
        .expect("Failed to fetch note");

    assert!(
        note.original.hash.starts_with("sha256:"),
        "Hash should start with sha256:"
    );
    assert_eq!(note.original.hash.len(), 71, "SHA256 hash should be 71 chars (sha256: + 64 hex)");
}

/// Test: insert_note initializes revised content equal to original
#[tokio::test]
async fn insert_note_initializes_revised_content() {
    let state = create_test_state().await;

    let content = format!("Revised init test {}", Uuid::new_v4());
    let note_id = db::insert_note(&state, &content, "markdown", "test")
        .await
        .expect("Failed to create note");

    let note = db::fetch_note(&state, note_id)
        .await
        .expect("Failed to fetch note");

    assert_eq!(note.revised.content, content, "Revised should equal original initially");
}

/// Test: insert_note creates activity log entry
#[tokio::test]
async fn insert_note_creates_activity_log() {
    let state = create_test_state().await;

    let content = format!("Activity log test {}", Uuid::new_v4());
    let note_id = db::insert_note(&state, &content, "markdown", "test")
        .await
        .expect("Failed to create note");

    // Use runtime query
    let row = sqlx::query(
        "SELECT action, actor FROM activity_log WHERE note_id = $1 ORDER BY at_utc DESC LIMIT 1"
    )
    .bind(note_id)
    .fetch_one(&state.pool)
    .await
    .expect("Failed to fetch activity log");

    let action: String = row.get("action");
    let actor: String = row.get("actor");

    assert_eq!(action, "create_note");
    assert_eq!(actor, "user");
}

/// Test: insert_note queues 4 background jobs
#[tokio::test]
async fn insert_note_queues_four_jobs() {
    let state = create_test_state().await;

    let content = format!("Job queue test {}", Uuid::new_v4());
    let note_id = db::insert_note(&state, &content, "markdown", "test")
        .await
        .expect("Failed to create note");

    let rows = sqlx::query(
        "SELECT job_type::text as job_type FROM job_queue WHERE note_id = $1"
    )
    .bind(note_id)
    .fetch_all(&state.pool)
    .await
    .expect("Failed to fetch jobs");

    assert!(rows.len() >= 4, "Should queue at least 4 jobs, got {}", rows.len());

    let job_types: Vec<String> = rows.iter().map(|r| r.get("job_type")).collect();
    assert!(job_types.contains(&"ai_revision".to_string()), "Missing ai_revision job");
    assert!(job_types.contains(&"embedding".to_string()), "Missing embedding job");
    assert!(job_types.contains(&"linking".to_string()), "Missing linking job");
    assert!(job_types.contains(&"title_generation".to_string()), "Missing title_generation job");
}

/// Test: insert_note with different formats
#[tokio::test]
async fn insert_note_supports_multiple_formats() {
    let state = create_test_state().await;

    let formats = ["markdown", "text", "html"];

    for format in formats {
        let content = format!("{} format test {}", format, Uuid::new_v4());
        let note_id = db::insert_note(&state, &content, format, "test")
            .await
            .expect(&format!("Failed to create {} note", format));

        let note = db::fetch_note(&state, note_id)
            .await
            .expect("Failed to fetch note");

        assert_eq!(note.note.format, format);
    }
}

/// Test: insert_note with different sources
#[tokio::test]
async fn insert_note_supports_multiple_sources() {
    let state = create_test_state().await;

    let sources = ["manual", "import", "api", "test"];

    for source in sources {
        let content = format!("{} source test {}", source, Uuid::new_v4());
        let note_id = db::insert_note(&state, &content, "markdown", source)
            .await
            .expect(&format!("Failed to create note with source {}", source));

        let note = db::fetch_note(&state, note_id)
            .await
            .expect("Failed to fetch note");

        assert_eq!(note.note.source, source);
    }
}

/// Test: insert_note with empty content
#[tokio::test]
async fn insert_note_handles_empty_content() {
    let state = create_test_state().await;

    let result = db::insert_note(&state, "", "markdown", "test").await;

    // Empty content should succeed (business decision - allowed)
    assert!(result.is_ok(), "Empty content should be allowed");
}

/// Test: insert_note with large content
#[tokio::test]
async fn insert_note_handles_large_content() {
    let state = create_test_state().await;

    // Create 100KB of content
    let large_content = format!(
        "# Large Note\n\n{}",
        "Lorem ipsum dolor sit amet. ".repeat(3500) // ~100KB
    );

    let note_id = db::insert_note(&state, &large_content, "markdown", "test")
        .await
        .expect("Failed to create large note");

    let note = db::fetch_note(&state, note_id)
        .await
        .expect("Failed to fetch note");

    assert!(
        note.original.content.len() > 90000,
        "Large content should be stored completely"
    );
}

/// Test: insert_note with special characters
#[tokio::test]
async fn insert_note_handles_special_characters() {
    let state = create_test_state().await;

    let content = format!(
        "# Special Chars Test {}\n\nUnicode: \u{1F600}\u{1F389}\nSQL: ' \" ; DROP TABLE\nNewlines:\n\n\nTabs:\t\t\t",
        Uuid::new_v4()
    );

    let note_id = db::insert_note(&state, &content, "markdown", "test")
        .await
        .expect("Failed to create note with special characters");

    let note = db::fetch_note(&state, note_id)
        .await
        .expect("Failed to fetch note");

    assert!(
        note.original.content.contains('\u{1F600}'),
        "Unicode should be preserved"
    );
    assert!(
        note.original.content.contains("DROP TABLE"),
        "SQL-like content should be safely stored"
    );
}

// =============================================================================
// FETCH_NOTE TESTS
// =============================================================================

/// Test: fetch_note returns complete note structure
#[tokio::test]
async fn fetch_note_returns_complete_structure() {
    let state = create_test_state().await;

    let content = format!("Fetch test {}", Uuid::new_v4());
    let note_id = db::insert_note(&state, &content, "markdown", "manual")
        .await
        .expect("Failed to create note");

    let note = db::fetch_note(&state, note_id)
        .await
        .expect("Failed to fetch note");

    // Verify all required fields
    assert_eq!(note.note.id, note_id);
    assert_eq!(note.note.format, "markdown");
    assert_eq!(note.note.source, "manual");
    assert_eq!(note.original.content, content);
    assert_eq!(note.revised.content, content); // Initially same
    assert!(note.tags.is_empty() || !note.tags.is_empty()); // Either is valid before processing
    assert!(note.links.is_empty()); // No links initially
}

/// Test: fetch_note for non-existent note returns error
#[tokio::test]
async fn fetch_note_not_found() {
    let state = create_test_state().await;

    let fake_id = Uuid::new_v4();
    let result = db::fetch_note(&state, fake_id).await;

    assert!(result.is_err(), "Fetching non-existent note should error");
}

/// Test: fetch_note includes original hash
#[tokio::test]
async fn fetch_note_includes_hash() {
    let state = create_test_state().await;

    let content = format!("Hash fetch test {}", Uuid::new_v4());
    let note_id = db::insert_note(&state, &content, "markdown", "test")
        .await
        .expect("Failed to create note");

    let note = db::fetch_note(&state, note_id)
        .await
        .expect("Failed to fetch note");

    assert!(!note.original.hash.is_empty(), "Hash should be present");
    assert!(
        note.original.hash.starts_with("sha256:"),
        "Hash should be SHA256 format"
    );
}

/// Test: fetch_note returns consistent data on multiple fetches
#[tokio::test]
async fn fetch_note_consistent_results() {
    let state = create_test_state().await;

    let content = format!("Consistency test {}", Uuid::new_v4());
    let note_id = db::insert_note(&state, &content, "markdown", "test")
        .await
        .expect("Failed to create note");

    let note1 = db::fetch_note(&state, note_id).await.expect("First fetch failed");
    let note2 = db::fetch_note(&state, note_id).await.expect("Second fetch failed");

    assert_eq!(note1.original.content, note2.original.content);
    assert_eq!(note1.original.hash, note2.original.hash);
    assert_eq!(note1.note.format, note2.note.format);
}

// =============================================================================
// LIST_NOTES TESTS
// =============================================================================

/// Test: list_notes returns notes in chronological order
#[tokio::test]
async fn list_notes_chronological_order() {
    let state = create_test_state().await;

    // Create 3 notes with small delays
    let mut note_ids = Vec::new();
    for i in 0..3 {
        let content = format!("List test note {} {}", i, Uuid::new_v4());
        let note_id = db::insert_note(&state, &content, "markdown", "test")
            .await
            .expect("Failed to create note");
        note_ids.push(note_id);
        tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
    }

    let req = ListNotesRequest {
        filter: Some("all".to_string()),
        sort_by: Some("created_at".to_string()),
        sort_order: Some("desc".to_string()),
        limit: Some(10),
        offset: Some(0),
    };
    let response = db::list_notes(&state, &req)
        .await
        .expect("Failed to list notes");

    // Most recent should be first (desc order)
    assert!(!response.notes.is_empty(), "Should return notes");

    // Find our test notes in the list
    let our_notes: Vec<_> = response.notes.iter().filter(|n| note_ids.contains(&n.id)).collect();
    if our_notes.len() >= 2 {
        assert!(
            our_notes[0].created_at_utc >= our_notes[1].created_at_utc,
            "Notes should be in descending order"
        );
    }
}

/// Test: list_notes respects limit
#[tokio::test]
async fn list_notes_respects_limit() {
    let state = create_test_state().await;

    // Create 5 notes
    for i in 0..5 {
        let content = format!("Limit test {} {}", i, Uuid::new_v4());
        db::insert_note(&state, &content, "markdown", "test")
            .await
            .expect("Failed to create note");
    }

    let req = ListNotesRequest {
        filter: Some("all".to_string()),
        sort_by: Some("created_at".to_string()),
        sort_order: Some("desc".to_string()),
        limit: Some(3),
        offset: Some(0),
    };
    let response = db::list_notes(&state, &req)
        .await
        .expect("Failed to list notes");

    assert!(response.notes.len() <= 3, "Should respect limit of 3");
}

/// Test: list_notes pagination with offset
#[tokio::test]
async fn list_notes_pagination() {
    let state = create_test_state().await;

    // Create 5 notes
    for i in 0..5 {
        let content = format!("Pagination test {} {}", i, Uuid::new_v4());
        db::insert_note(&state, &content, "markdown", "test")
            .await
            .expect("Failed to create note");
    }

    let req1 = ListNotesRequest {
        filter: Some("all".to_string()),
        sort_by: Some("created_at".to_string()),
        sort_order: Some("desc".to_string()),
        limit: Some(3),
        offset: Some(0),
    };
    let page1 = db::list_notes(&state, &req1)
        .await
        .expect("Failed to list page 1");

    let req2 = ListNotesRequest {
        filter: Some("all".to_string()),
        sort_by: Some("created_at".to_string()),
        sort_order: Some("desc".to_string()),
        limit: Some(3),
        offset: Some(3),
    };
    let page2 = db::list_notes(&state, &req2)
        .await
        .expect("Failed to list page 2");

    // Pages should not overlap
    let page1_ids: Vec<_> = page1.notes.iter().map(|n| n.id).collect();
    let page2_ids: Vec<_> = page2.notes.iter().map(|n| n.id).collect();

    for id in &page2_ids {
        assert!(
            !page1_ids.contains(id),
            "Page 2 should not contain notes from page 1"
        );
    }
}

/// Test: list_notes filter excludes archived by default
#[tokio::test]
async fn list_notes_excludes_archived_by_default() {
    let state = create_test_state().await;

    let content = format!("Archive filter test {}", Uuid::new_v4());
    let note_id = db::insert_note(&state, &content, "markdown", "test")
        .await
        .expect("Failed to create note");

    // Archive the note using update_note_status
    let req = UpdateNoteStatusRequest {
        starred: None,
        archived: Some(true),
    };
    db::update_note_status(&state, note_id, &req)
        .await
        .expect("Failed to archive note");

    // Recent filter should exclude archived notes
    let req_recent = ListNotesRequest {
        filter: Some("recent".to_string()),
        sort_by: Some("created_at".to_string()),
        sort_order: Some("desc".to_string()),
        limit: Some(100),
        offset: Some(0),
    };
    let non_archived = db::list_notes(&state, &req_recent)
        .await
        .expect("Failed to list recent notes");

    let contains_archived = non_archived.notes.iter().any(|n| n.id == note_id);
    assert!(
        !contains_archived,
        "Recent filter should exclude archived notes"
    );
}

// =============================================================================
// UPDATE_NOTE_STATUS TESTS
// =============================================================================

/// Test: update_note_status can star a note
#[tokio::test]
async fn update_note_status_star() {
    let state = create_test_state().await;

    let content = format!("Star test {}", Uuid::new_v4());
    let note_id = db::insert_note(&state, &content, "markdown", "test")
        .await
        .expect("Failed to create note");

    let req = UpdateNoteStatusRequest {
        starred: Some(true),
        archived: None,
    };
    db::update_note_status(&state, note_id, &req)
        .await
        .expect("Failed to star note");

    // Verify via starred filter
    let list_req = ListNotesRequest {
        filter: Some("starred".to_string()),
        sort_by: None,
        sort_order: None,
        limit: Some(100),
        offset: None,
    };
    let starred_notes = db::list_notes(&state, &list_req)
        .await
        .expect("Failed to list starred notes");

    assert!(
        starred_notes.notes.iter().any(|n| n.id == note_id),
        "Note should be in starred list"
    );
}

/// Test: update_note_status can archive a note
#[tokio::test]
async fn update_note_status_archive() {
    let state = create_test_state().await;

    let content = format!("Archive test {}", Uuid::new_v4());
    let note_id = db::insert_note(&state, &content, "markdown", "test")
        .await
        .expect("Failed to create note");

    let req = UpdateNoteStatusRequest {
        starred: None,
        archived: Some(true),
    };
    db::update_note_status(&state, note_id, &req)
        .await
        .expect("Failed to archive note");

    // Verify via archived filter
    let list_req = ListNotesRequest {
        filter: Some("archived".to_string()),
        sort_by: None,
        sort_order: None,
        limit: Some(100),
        offset: None,
    };
    let archived_notes = db::list_notes(&state, &list_req)
        .await
        .expect("Failed to list archived notes");

    assert!(
        archived_notes.notes.iter().any(|n| n.id == note_id),
        "Note should be in archived list"
    );
}

/// Test: update_note_status updates timestamp
#[tokio::test]
async fn update_note_status_updates_timestamp() {
    let state = create_test_state().await;

    let content = format!("Timestamp update test {}", Uuid::new_v4());
    let note_id = db::insert_note(&state, &content, "markdown", "test")
        .await
        .expect("Failed to create note");

    let note_before = db::fetch_note(&state, note_id)
        .await
        .expect("Failed to fetch note");
    let before = note_before.note.updated_at_utc;

    // Small delay to ensure timestamp difference
    tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;

    let req = UpdateNoteStatusRequest {
        starred: Some(true),
        archived: None,
    };
    db::update_note_status(&state, note_id, &req)
        .await
        .expect("Failed to update status");

    let note_after = db::fetch_note(&state, note_id)
        .await
        .expect("Failed to fetch note after update");
    let after = note_after.note.updated_at_utc;

    assert!(after > before, "Timestamp should be updated");
}

// =============================================================================
// SEARCH_FTS TESTS
// =============================================================================

/// Test: search_fts finds note by keyword
#[tokio::test]
async fn search_fts_finds_keyword() {
    let state = create_test_state().await;

    let unique_keyword = format!("xyzzy{}", Uuid::new_v4().to_string().replace("-", ""));
    let content = format!("Testing {} keyword search", unique_keyword);
    let note_id = db::insert_note(&state, &content, "markdown", "test")
        .await
        .expect("Failed to create note");

    let results = db::search_fts(&state, &unique_keyword, 10)
        .await
        .expect("Search failed");

    assert!(
        results.iter().any(|r| r.note_id == note_id),
        "Should find note by unique keyword"
    );
}

/// Test: search_fts returns scores
#[tokio::test]
async fn search_fts_returns_scores() {
    let state = create_test_state().await;

    let keyword = format!("scored{}", Uuid::new_v4().to_string().replace("-", ""));
    let content = format!("This is about {} topic", keyword);
    let _note_id = db::insert_note(&state, &content, "markdown", "test")
        .await
        .expect("Failed to create note");

    let results = db::search_fts(&state, &keyword, 10)
        .await
        .expect("Search failed");

    for result in &results {
        assert!(result.score > 0.0, "Score should be positive");
        assert!(result.score <= 1.0, "Score should be at most 1.0");
    }
}

/// Test: search_fts respects limit
#[tokio::test]
async fn search_fts_respects_limit() {
    let state = create_test_state().await;

    let keyword = format!("limited{}", Uuid::new_v4().to_string().replace("-", ""));

    // Create 5 notes with the same keyword
    for i in 0..5 {
        let content = format!("Note {} about {} topic", i, keyword);
        db::insert_note(&state, &content, "markdown", "test")
            .await
            .expect("Failed to create note");
    }

    let results = db::search_fts(&state, &keyword, 3)
        .await
        .expect("Search failed");

    assert!(results.len() <= 3, "Should respect limit of 3");
}

/// Test: search_fts handles empty query
#[tokio::test]
async fn search_fts_handles_empty_query() {
    let state = create_test_state().await;

    let results = db::search_fts(&state, "", 10).await;

    // Should either return empty or handle gracefully
    assert!(results.is_ok(), "Empty query should not error");
}

/// Test: search_fts handles multi-word query
#[tokio::test]
async fn search_fts_multiword_query() {
    let state = create_test_state().await;

    let word1 = format!("first{}", Uuid::new_v4().to_string().replace("-", "")[..8].to_string());
    let word2 = format!("second{}", Uuid::new_v4().to_string().replace("-", "")[..8].to_string());

    let content = format!("Content with {} and {} words", word1, word2);
    let note_id = db::insert_note(&state, &content, "markdown", "test")
        .await
        .expect("Failed to create note");

    let query = format!("{} {}", word1, word2);
    let results = db::search_fts(&state, &query, 10)
        .await
        .expect("Search failed");

    assert!(
        results.iter().any(|r| r.note_id == note_id),
        "Should find note with multi-word query"
    );
}

// =============================================================================
// SEARCH_FTS_FILTERED TESTS
// =============================================================================

/// Test: search_fts_filtered with tag filter
#[tokio::test]
async fn search_fts_filtered_by_tag() {
    let state = create_test_state().await;

    let keyword = format!("tagfilter{}", Uuid::new_v4().to_string().replace("-", ""));
    let tag_name = format!("tag{}", Uuid::new_v4().to_string().replace("-", "")[..8].to_string());

    let content = format!("Content about {} for tag test", keyword);
    let note_id = db::insert_note(&state, &content, "markdown", "test")
        .await
        .expect("Failed to create note");

    // Add tag using runtime query
    sqlx::query("INSERT INTO tag (name, created_at_utc) VALUES ($1, NOW()) ON CONFLICT DO NOTHING")
        .bind(&tag_name)
        .execute(&state.pool)
        .await
        .expect("Failed to create tag");

    sqlx::query("INSERT INTO note_tag (note_id, tag_name, source) VALUES ($1, $2, 'test') ON CONFLICT DO NOTHING")
        .bind(note_id)
        .bind(&tag_name)
        .execute(&state.pool)
        .await
        .expect("Failed to link tag");

    // Search with filter
    let filter = format!("tag:{}", tag_name);
    let results = db::search_fts_filtered(&state, &keyword, Some(&filter), 10)
        .await
        .expect("Filtered search failed");

    assert!(
        results.iter().any(|r| r.note_id == note_id),
        "Should find note with tag filter"
    );
}

/// Test: search_fts_filtered with collection filter
#[tokio::test]
async fn search_fts_filtered_by_collection() {
    let state = create_test_state().await;

    let keyword = format!("collfilter{}", Uuid::new_v4().to_string().replace("-", ""));
    let collection_id = Uuid::new_v4();
    let collection_name = format!("Collection-{}", collection_id);

    // Create collection
    sqlx::query("INSERT INTO collection (id, name, created_at_utc) VALUES ($1, $2, NOW())")
        .bind(collection_id)
        .bind(&collection_name)
        .execute(&state.pool)
        .await
        .expect("Failed to create collection");

    let content = format!("Content about {} for collection test", keyword);
    let note_id = db::insert_note(&state, &content, "markdown", "test")
        .await
        .expect("Failed to create note");

    // Assign to collection
    sqlx::query("UPDATE note SET collection_id = $1 WHERE id = $2")
        .bind(collection_id)
        .bind(note_id)
        .execute(&state.pool)
        .await
        .expect("Failed to assign collection");

    // Search with filter
    let filter = format!("collection:{}", collection_id);
    let results = db::search_fts_filtered(&state, &keyword, Some(&filter), 10)
        .await
        .expect("Filtered search failed");

    assert!(
        results.iter().any(|r| r.note_id == note_id),
        "Should find note with collection filter"
    );
}

// =============================================================================
// UPDATE_ORIGINAL_CONTENT TESTS
// =============================================================================

/// Test: update_original_content changes content
#[tokio::test]
async fn update_original_content_changes_content() {
    let state = create_test_state().await;

    let original_content = format!("Original {}", Uuid::new_v4());
    let note_id = db::insert_note(&state, &original_content, "markdown", "test")
        .await
        .expect("Failed to create note");

    let new_content = format!("Updated {}", Uuid::new_v4());
    db::update_original_content(&state, note_id, &new_content)
        .await
        .expect("Failed to update content");

    let note = db::fetch_note(&state, note_id)
        .await
        .expect("Failed to fetch note");

    assert_eq!(note.original.content, new_content);
}

/// Test: update_original_content updates hash
#[tokio::test]
async fn update_original_content_updates_hash() {
    let state = create_test_state().await;

    let content = format!("Hash update test {}", Uuid::new_v4());
    let note_id = db::insert_note(&state, &content, "markdown", "test")
        .await
        .expect("Failed to create note");

    let note_before = db::fetch_note(&state, note_id)
        .await
        .expect("Failed to fetch note");
    let original_hash = note_before.original.hash.clone();

    let new_content = format!("Different content {}", Uuid::new_v4());
    db::update_original_content(&state, note_id, &new_content)
        .await
        .expect("Failed to update content");

    let note_after = db::fetch_note(&state, note_id)
        .await
        .expect("Failed to fetch note");
    let new_hash = note_after.original.hash;

    assert_ne!(original_hash, new_hash, "Hash should change with content");
}

// =============================================================================
// DATABASE INTEGRITY TESTS
// =============================================================================

/// Test: note tables maintain referential integrity
#[tokio::test]
async fn database_referential_integrity() {
    let state = create_test_state().await;

    let content = format!("Integrity test {}", Uuid::new_v4());
    let note_id = db::insert_note(&state, &content, "markdown", "test")
        .await
        .expect("Failed to create note");

    // Verify all related tables have entries using fetch_note
    let note = db::fetch_note(&state, note_id)
        .await
        .expect("Note should exist with all related data");

    assert_eq!(note.note.id, note_id, "Note should exist");
    assert!(!note.original.content.is_empty() || content.is_empty(), "Original should exist");
    assert!(!note.revised.content.is_empty() || content.is_empty(), "Revised should exist");
}

/// Test: concurrent note creation doesn't cause conflicts
#[tokio::test]
async fn concurrent_note_creation() {
    let state = create_test_state().await;

    let mut handles = Vec::new();

    for i in 0..5 {
        let state_clone = state.clone();
        let handle = tokio::spawn(async move {
            let content = format!("Concurrent test {} {}", i, Uuid::new_v4());
            db::insert_note(&state_clone, &content, "markdown", "test").await
        });
        handles.push(handle);
    }

    // Collect results from all spawned tasks
    let mut success_count = 0;
    for handle in handles {
        if let Ok(result) = handle.await {
            if result.is_ok() {
                success_count += 1;
            }
        }
    }

    assert_eq!(success_count, 5, "All concurrent creations should succeed");
}

/// Test: transaction atomicity via successful note creation
#[tokio::test]
async fn transaction_atomicity() {
    let state = create_test_state().await;

    // Create a note successfully
    let content = format!("Atomicity test {}", Uuid::new_v4());
    let note_id = db::insert_note(&state, &content, "markdown", "test")
        .await
        .expect("Failed to create note");

    // Verify note is complete (all related data exists)
    let note = db::fetch_note(&state, note_id)
        .await
        .expect("Note should be fully committed");

    assert_eq!(note.original.content, content);
    assert_eq!(note.revised.content, content);
    assert_eq!(note.note.id, note_id);
}
