use crate::db::AppState;
use axum::Json;
use serde::Serialize;

#[derive(Serialize)]
pub struct Health {
    pub ok: bool,
    pub ollama: bool,
    pub db: bool,
    pub vector: bool,
}

#[derive(Serialize)]
pub struct ApiInfo {
    pub name: String,
    pub version: String,
    pub endpoints: Vec<String>,
}

pub async fn health(state: axum::extract::State<AppState>) -> Json<Health> {
    // Ollama ping
    let ollama_ok = reqwest::get("http://127.0.0.1:11434/api/tags")
        .await
        .is_ok();
    // DB check
    let db_ok = sqlx::query_scalar::<_, i32>("SELECT 1")
        .fetch_one(&state.pool)
        .await
        .is_ok();
    let vector_ok = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector')",
    )
    .fetch_one(&state.pool)
    .await
    .unwrap_or(false);
    Json(Health {
        ok: ollama_ok && db_ok && vector_ok,
        ollama: ollama_ok,
        db: db_ok,
        vector: vector_ok,
    })
}

pub async fn api_info() -> Json<ApiInfo> {
    Json(ApiInfo {
        name: "Hall of the Mind API".to_string(),
        version: "v1".to_string(),
        endpoints: vec![
            "GET  /api/v1/health".to_string(),
            "POST /api/v1/notes".to_string(),
            "GET  /api/v1/notes/{id}".to_string(),
            "PUT  /api/v1/notes/{id}/revised".to_string(),
            "GET  /api/v1/search?q={query}".to_string(),
            "POST /api/v1/semantic".to_string(),
            "POST /api/v1/tags".to_string(),
            "PUT  /api/v1/notes/{id}/tags".to_string(),
            "POST /api/v1/collections".to_string(),
            "PUT  /api/v1/notes/{id}/collection".to_string(),
            "POST /api/v1/notes/{id}/links".to_string(),
            "GET  /api/v1/notes/{id}/provenance".to_string(),
        ],
    })
}
