#[cfg(test)]
mod tests {
    use super::super::*;
    use axum::Router;
    use axum::routing::{get, post};
    use serde_json::json;
    use tower::ServiceExt; // for `oneshot`

    #[tokio::test]
    async fn health_ok() {
        let state = crate::db::AppState { pool: sqlx::PgPool::connect_lazy("postgres://localhost/ignore").unwrap() };
        let app = Router::new().route("/api/v1/health", get(crate::routes::health::health)).with_state(state);
        let res = app.oneshot(axum::http::Request::builder().uri("/api/v1/health").body(axum::body::Body::empty()).unwrap()).await.unwrap();
        assert!(res.status().is_success());
    }
}
