//! Health check endpoints

use axum::{extract::State, http::StatusCode, Json};
use hotm_core::ollama::client::AIService;
use serde_json::{json, Value};
use crate::app_state::AppState;

pub async fn health_check(State(state): State<AppState>) -> Result<Json<Value>, StatusCode> {
    // Check database connection
    if state.database.health_check().await.is_err() {
        return Err(StatusCode::SERVICE_UNAVAILABLE);
    }

    // Check Ollama connection (optional - don't fail if it's down)
    let ollama_status = match <_ as AIService>::health_check(&state.ollama_client).await {
        Ok(_) => "healthy",
        Err(_) => "unavailable",
    };

    Ok(Json(json!({
        "status": "healthy",
        "database": "healthy",
        "ollama": ollama_status,
        "version": env!("CARGO_PKG_VERSION")
    })))
}

pub async fn api_info() -> Json<Value> {
    Json(json!({
        "service": "HotM API Server",
        "version": env!("CARGO_PKG_VERSION"),
        "description": "Standalone HTTP API server for HotM notes application",
        "endpoints": {
            "health": "/health",
            "notes": "/api/v1/notes",
            "search": "/api/v1/search",
            "websocket": "/api/v1/ws"
        }
    }))
}