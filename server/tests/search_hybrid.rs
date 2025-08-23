use hotm_server::db::AppState;
use hotm_server::websocket::create_broadcaster;

#[tokio::test]
async fn hybrid_search_does_not_panic() {
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
