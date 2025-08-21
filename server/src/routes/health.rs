use axum::{Json};
use serde::Serialize;
use crate::db::AppState;

#[derive(Serialize)]
struct Health { ok: bool, ollama: bool }

pub async fn health(state: axum::extract::State<AppState>) -> Json<Health> {
    // Simple Ollama ping
    let ollama_ok = reqwest::get("http://127.0.0.1:11434/api/tags").await.is_ok();
    Json(Health { ok: true, ollama: ollama_ok })
}
