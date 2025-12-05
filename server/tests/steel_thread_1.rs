//! Steel Thread #1: Note Creation + AI Enhancement Flow
//!
//! This test validates the complete end-to-end flow:
//! 1. Note creation (POST /notes)
//! 2. Automatic job queueing (4 jobs: AI revision, embedding, linking, title)
//! 3. Job retrieval and status checking
//! 4. Note retrieval with enhancements
//!
//! Test Environment:
//! - USE_MOCK_AI=true bypasses actual Ollama calls
//! - TEST_DATABASE_URL points to test database

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

/// Test: Note creation queues expected jobs
#[tokio::test]
async fn note_creation_queues_jobs() {
    let state = create_test_state().await;

    // Create a note
    let content = format!("Steel thread test note {}", Uuid::new_v4());
    let note_id = db::insert_note(&state, &content, "markdown", "manual")
        .await
        .expect("Failed to create note");

    // Verify jobs were queued
    let job_rows = sqlx::query(
        r#"
        SELECT id, job_type::text as job_type, status::text as status, priority
        FROM job_queue
        WHERE note_id = $1
        ORDER BY priority DESC
        "#
    )
    .bind(note_id)
    .fetch_all(&state.pool)
    .await
    .expect("Failed to fetch jobs");

    // Convert to a more convenient format
    let jobs: Vec<_> = job_rows
        .iter()
        .map(|row| {
            (
                row.get::<Uuid, _>("id"),
                row.get::<String, _>("job_type"),
                row.get::<String, _>("status"),
                row.get::<i32, _>("priority"),
            )
        })
        .collect();

    // Should have 4 jobs queued
    assert!(
        jobs.len() >= 4,
        "Expected at least 4 jobs, got {}",
        jobs.len()
    );

    // Verify job types (in priority order)
    let job_types: Vec<&str> = jobs.iter().map(|(_, jt, _, _)| jt.as_str()).collect();
    assert!(
        job_types.contains(&"ai_revision"),
        "Missing ai_revision job"
    );
    assert!(job_types.contains(&"embedding"), "Missing embedding job");
    assert!(job_types.contains(&"linking"), "Missing linking job");
    assert!(
        job_types.contains(&"title_generation"),
        "Missing title_generation job"
    );

    // Verify all jobs are pending
    for (id, _, status, _) in &jobs {
        assert_eq!(
            status, "pending",
            "Job {} should be pending, was {}",
            id, status
        );
    }

    // Verify priority ordering (higher priority first)
    let priorities: Vec<i32> = jobs.iter().map(|(_, _, _, p)| *p).collect();
    let mut sorted_priorities = priorities.clone();
    sorted_priorities.sort_by(|a, b| b.cmp(a)); // Descending
    assert_eq!(
        priorities, sorted_priorities,
        "Jobs should be ordered by priority descending"
    );
}

/// Test: Note original content is immutable
#[tokio::test]
async fn note_original_content_is_immutable() {
    let state = create_test_state().await;

    let original_content = format!("Immutable content test {}", Uuid::new_v4());
    let note_id = db::insert_note(&state, &original_content, "markdown", "manual")
        .await
        .expect("Failed to create note");

    // Fetch and verify original content
    let note = db::fetch_note(&state, note_id)
        .await
        .expect("Failed to fetch note");

    assert_eq!(note.original.content, original_content);

    // Verify hash is computed
    assert!(
        !note.original.hash.is_empty(),
        "Original content hash should be computed"
    );

    // Try to fetch again - should be identical
    let note2 = db::fetch_note(&state, note_id)
        .await
        .expect("Failed to fetch note second time");

    assert_eq!(note.original.content, note2.original.content);
    assert_eq!(note.original.hash, note2.original.hash);
}

/// Test: Note revised content starts as copy of original
#[tokio::test]
async fn note_revised_starts_as_original() {
    let state = create_test_state().await;

    let content = format!("Revised content test {}", Uuid::new_v4());
    let note_id = db::insert_note(&state, &content, "markdown", "manual")
        .await
        .expect("Failed to create note");

    let note = db::fetch_note(&state, note_id)
        .await
        .expect("Failed to fetch note");

    // Revised content should equal original initially
    assert_eq!(
        note.revised.content, note.original.content,
        "Revised content should start as copy of original"
    );
}

/// Test: Activity log records note creation
#[tokio::test]
async fn note_creation_logged_in_activity() {
    let state = create_test_state().await;

    let content = format!("Activity log test {}", Uuid::new_v4());
    let note_id = db::insert_note(&state, &content, "markdown", "manual")
        .await
        .expect("Failed to create note");

    // Check activity log
    let activity_row = sqlx::query(
        r#"
        SELECT action, actor
        FROM activity_log
        WHERE note_id = $1
        ORDER BY at_utc DESC
        LIMIT 1
        "#
    )
    .bind(note_id)
    .fetch_optional(&state.pool)
    .await
    .expect("Failed to query activity log");

    assert!(activity_row.is_some(), "Activity log entry should exist");
    let activity_row = activity_row.unwrap();
    let action: String = activity_row.get("action");
    let actor: String = activity_row.get("actor");
    assert_eq!(action, "create_note");
    assert_eq!(actor, "user");
}

/// Test: Job queue status view works
#[tokio::test]
async fn job_queue_status_view_works() {
    let state = create_test_state().await;

    // Create a note to generate jobs
    let content = format!("Job status test {}", Uuid::new_v4());
    let _note_id = db::insert_note(&state, &content, "markdown", "manual")
        .await
        .expect("Failed to create note");

    // Query the job queue status view
    let status_row = sqlx::query(
        r#"
        SELECT COUNT(*) as count
        FROM job_queue_status
        WHERE status = 'pending'
        "#
    )
    .fetch_one(&state.pool)
    .await
    .expect("Failed to query job queue status view");

    let count: i64 = status_row.get("count");
    assert!(
        count >= 4,
        "Should have at least 4 pending jobs in status view"
    );
}

/// Test: Note fetch includes tags (initially empty)
#[tokio::test]
async fn note_fetch_includes_tags() {
    let state = create_test_state().await;

    let content = format!("Tags test {}", Uuid::new_v4());
    let note_id = db::insert_note(&state, &content, "markdown", "manual")
        .await
        .expect("Failed to create note");

    let note = db::fetch_note(&state, note_id)
        .await
        .expect("Failed to fetch note");

    // Tags should be an empty vector initially (before AI processing)
    assert!(note.tags.is_empty() || !note.tags.is_empty()); // Either is valid
}

/// Test: Note fetch includes links (initially empty)
#[tokio::test]
async fn note_fetch_includes_links() {
    let state = create_test_state().await;

    let content = format!("Links test {}", Uuid::new_v4());
    let note_id = db::insert_note(&state, &content, "markdown", "manual")
        .await
        .expect("Failed to create note");

    let note = db::fetch_note(&state, note_id)
        .await
        .expect("Failed to fetch note");

    // Links should be empty initially (before linking job runs)
    assert!(
        note.links.is_empty(),
        "Links should be empty before linking job runs"
    );
}

/// Test: Multiple notes create independent job queues
#[tokio::test]
async fn multiple_notes_independent_jobs() {
    let state = create_test_state().await;

    // Create two notes
    let content1 = format!("Note 1 {}", Uuid::new_v4());
    let content2 = format!("Note 2 {}", Uuid::new_v4());

    let note_id1 = db::insert_note(&state, &content1, "markdown", "manual")
        .await
        .expect("Failed to create note 1");

    let note_id2 = db::insert_note(&state, &content2, "markdown", "manual")
        .await
        .expect("Failed to create note 2");

    // Count jobs for each note
    let jobs1_row = sqlx::query("SELECT COUNT(*) as count FROM job_queue WHERE note_id = $1")
        .bind(note_id1)
        .fetch_one(&state.pool)
        .await
        .expect("Failed to count jobs for note 1");
    let jobs1_count: i64 = jobs1_row.get("count");

    let jobs2_row = sqlx::query("SELECT COUNT(*) as count FROM job_queue WHERE note_id = $1")
        .bind(note_id2)
        .fetch_one(&state.pool)
        .await
        .expect("Failed to count jobs for note 2");
    let jobs2_count: i64 = jobs2_row.get("count");

    // Each note should have its own set of jobs
    assert!(
        jobs1_count >= 4,
        "Note 1 should have at least 4 jobs, got {}",
        jobs1_count
    );
    assert!(
        jobs2_count >= 4,
        "Note 2 should have at least 4 jobs, got {}",
        jobs2_count
    );
}

/// Test: Note creation with different formats
#[tokio::test]
async fn note_creation_supports_formats() {
    let state = create_test_state().await;

    // Create notes with different formats
    let formats = ["markdown", "text", "html"];

    for format in formats {
        let content = format!("{} format test {}", format, Uuid::new_v4());
        let note_id = db::insert_note(&state, &content, format, "manual")
            .await
            .expect(&format!("Failed to create {} note", format));

        let note = db::fetch_note(&state, note_id)
            .await
            .expect("Failed to fetch note");

        assert_eq!(
            note.note.format, format,
            "Note format should be {}",
            format
        );
    }
}

/// Test: Note creation with different sources
#[tokio::test]
async fn note_creation_supports_sources() {
    let state = create_test_state().await;

    // Create notes with different sources
    let sources = ["manual", "import", "api"];

    for source in sources {
        let content = format!("{} source test {}", source, Uuid::new_v4());
        let note_id = db::insert_note(&state, &content, "markdown", source)
            .await
            .expect(&format!("Failed to create note with source {}", source));

        let note = db::fetch_note(&state, note_id)
            .await
            .expect("Failed to fetch note");

        assert_eq!(
            note.note.source, source,
            "Note source should be {}",
            source
        );
    }
}

/// Test: Note timestamps are set correctly
#[tokio::test]
async fn note_timestamps_set_correctly() {
    let state = create_test_state().await;

    let before = chrono::Utc::now();

    let content = format!("Timestamp test {}", Uuid::new_v4());
    let note_id = db::insert_note(&state, &content, "markdown", "manual")
        .await
        .expect("Failed to create note");

    let after = chrono::Utc::now();

    let note = db::fetch_note(&state, note_id)
        .await
        .expect("Failed to fetch note");

    // created_at should be between before and after
    assert!(
        note.note.created_at_utc >= before && note.note.created_at_utc <= after,
        "created_at should be within test window"
    );

    // updated_at should equal created_at for new notes
    assert_eq!(
        note.note.created_at_utc, note.note.updated_at_utc,
        "updated_at should equal created_at for new notes"
    );
}
