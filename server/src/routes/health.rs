use axum::Json;
use serde::Serialize;
use crate::db::AppState;

#[derive(Serialize)]
struct Health { ok: bool, ollama: bool, db: bool, vector: bool }

pub async fn health(state: axum::extract::State<AppState>) -> Json<Health> {
    // Ollama ping
    let ollama_ok = reqwest::get("http://127.0.0.1:11434/api/tags").await.is_ok();
    // DB check
    let db_ok = sqlx::query_scalar::<_, i32>("SELECT 1")
        .fetch_one(&state.pool).await.is_ok();
    let vector_ok = sqlx::query_scalar::<_, bool>("SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector')")
        .fetch_one(&state.pool).await.unwrap_or(false);
    Json(Health { ok: ollama_ok && db_ok && vector_ok, ollama: ollama_ok, db: db_ok, vector: vector_ok })
}
