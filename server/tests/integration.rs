#[tokio::test]
async fn create_and_get_note_roundtrip() {
    let db_url = std::env::var("TEST_DATABASE_URL").expect("TEST_DATABASE_URL must be set");
    let (broadcaster, _) = hotm_server::websocket::create_broadcaster();
    let state = hotm_server::db::AppState::connect(&db_url, broadcaster)
        .await
        .unwrap();

    // Create
    let content = "Test note content";
    let id = hotm_server::db::insert_note(&state, content, "markdown", "manual")
        .await
        .unwrap();

    // Get
    let note = hotm_server::db::fetch_note(&state, id).await.unwrap();
    assert_eq!(note.note.id, id);
    assert_eq!(note.original.content, content);
}
