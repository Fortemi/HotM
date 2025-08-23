use hotm_server::db::AppState;
use uuid::Uuid;

#[tokio::test]
async fn tags_collections_links_roundtrip() {
    let db_url = std::env::var("TEST_DATABASE_URL").expect("TEST_DATABASE_URL must be set");
    let state = AppState::connect(&db_url).await.unwrap();

    // create note
    let a = hotm_server::db::insert_note(&state, "alpha", "markdown", "manual")
        .await
        .unwrap();
    let b = hotm_server::db::insert_note(&state, "beta", "markdown", "manual")
        .await
        .unwrap();

    // add tag
    sqlx::query!("INSERT INTO tag (name) VALUES ('project-x') ON CONFLICT DO NOTHING")
        .execute(&state.pool)
        .await
        .unwrap();
    sqlx::query!("INSERT INTO note_tag (note_id, tag_name, source) VALUES ($1, 'project-x', 'manual') ON CONFLICT DO NOTHING", a).execute(&state.pool).await.unwrap();

    // create collection and assign
    let cid = Uuid::new_v4();
    sqlx::query!("INSERT INTO collection (id, name) VALUES ($1, 'Work')", cid)
        .execute(&state.pool)
        .await
        .unwrap();
    sqlx::query!("UPDATE note SET collection_id = $1 WHERE id = $2", cid, a)
        .execute(&state.pool)
        .await
        .unwrap();

    // link a -> b
    let lid = Uuid::new_v4();
    sqlx::query!("INSERT INTO link (id, from_note_id, to_note_id, kind, score, created_at_utc) VALUES ($1, $2, $3, 'related', 0.9, NOW())", lid, a, b).execute(&state.pool).await.unwrap();

    // search filter by tag and collection
    let hits_tag = hotm_server::db::search_fts_filtered(&state, "alpha", Some("tag:project-x"), 10)
        .await
        .unwrap();
    assert!(hits_tag.iter().any(|h| h.note_id == a));
    let hits_coll = hotm_server::db::search_fts_filtered(
        &state,
        "alpha",
        Some(&format!("collection:{}", cid)),
        10,
    )
    .await
    .unwrap();
    assert!(hits_coll.iter().any(|h| h.note_id == a));
}
