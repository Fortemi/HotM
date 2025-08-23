use hotm_server::db::AppState;
use hotm_server::websocket::create_broadcaster;
use tower::util::ServiceExt;

#[tokio::test]
async fn test_search_does_not_panic() {
    let db_url = std::env::var("TEST_DATABASE_URL").expect("TEST_DATABASE_URL must be set");
    let (broadcaster, _) = create_broadcaster();
    let state = AppState::connect(&db_url, broadcaster).await.unwrap();

    // Should handle empty indices gracefully
    let app = axum::Router::new()
        .route(
            "/api/v1/search",
            axum::routing::get(hotm_server::routes::search::search),
        )
        .with_state(state);

    let res = app
        .oneshot(
            axum::http::Request::builder()
                .uri("/api/v1/search?q=test&mode=fts")
                .body(axum::body::Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert!(res.status().is_success());
}

#[tokio::test]
async fn test_hybrid_search_does_not_panic() {
    let db_url = std::env::var("TEST_DATABASE_URL").expect("TEST_DATABASE_URL must be set");
    let (broadcaster, _) = create_broadcaster();
    let state = AppState::connect(&db_url, broadcaster).await.unwrap();

    // Should handle empty indices gracefully
    let app = axum::Router::new()
        .route(
            "/api/v1/search",
            axum::routing::get(hotm_server::routes::search::search),
        )
        .with_state(state);

    let res = app
        .oneshot(
            axum::http::Request::builder()
                .uri("/api/v1/search?q=test&mode=hybrid")
                .body(axum::body::Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert!(res.status().is_success());
}

#[tokio::test]
async fn test_semantic_search_does_not_panic() {
    // Skip semantic search tests when using mock AI since they require Ollama
    let use_mock_ai = std::env::var("USE_MOCK_AI").unwrap_or_default() == "true";
    if use_mock_ai {
        println!("Skipping semantic search test with mock AI");
        return;
    }

    let db_url = std::env::var("TEST_DATABASE_URL").expect("TEST_DATABASE_URL must be set");
    let (broadcaster, _) = create_broadcaster();
    let state = AppState::connect(&db_url, broadcaster).await.unwrap();

    // Should handle empty indices gracefully
    let app = axum::Router::new()
        .route(
            "/api/v1/semantic",
            axum::routing::post(hotm_server::routes::search::semantic),
        )
        .with_state(state);

    let res = app
        .oneshot(
            axum::http::Request::builder()
                .uri("/api/v1/semantic")
                .method("POST")
                .header("content-type", "application/json")
                .body(axum::body::Body::from(r#"{"text": "test query"}"#))
                .unwrap(),
        )
        .await
        .unwrap();
    assert!(res.status().is_success());
}
