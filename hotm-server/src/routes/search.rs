//! Search API endpoints

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use hotm_core::{
    models::*,
    ollama::client::{embed_texts},
};
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

use crate::app_state::AppState;

#[derive(Deserialize)]
pub struct SearchQuery {
    pub q: String,
    pub limit: Option<i64>,
}

pub async fn search(
    State(state): State<AppState>,
    Query(query): Query<SearchQuery>,
) -> Result<Json<SearchResponse>, StatusCode> {
    let limit = query.limit.unwrap_or(10);
    
    match state.note_repository.search_notes_fts(&query.q, limit).await {
        Ok(notes) => Ok(Json(SearchResponse { notes })),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

pub async fn semantic(
    State(state): State<AppState>,
    Json(req): Json<SemanticRequest>,
) -> Result<Json<SemanticResponse>, StatusCode> {
    // Generate embeddings for the query
    match embed_texts(vec![req.text.clone()], &state.embed_model).await {
        Ok(embeddings) => {
            if let Some(query_embedding) = embeddings.into_iter().next() {
                match state.note_repository.search_notes_semantic(query_embedding, 10).await {
                    Ok(similar) => Ok(Json(SemanticResponse { similar })),
                    Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
                }
            } else {
                Err(StatusCode::INTERNAL_SERVER_ERROR)
            }
        }
        Err(_) => Err(StatusCode::SERVICE_UNAVAILABLE), // Ollama not available
    }
}

pub async fn generate_search_context(
    State(_state): State<AppState>,
    Json(_req): Json<Value>,
) -> Result<Json<Value>, StatusCode> {
    // This would implement search context generation using the Ollama client
    // For now, return a placeholder
    Ok(Json(json!({
        "context": "Search context generation not yet implemented",
        "suggestions": []
    })))
}

pub async fn find_related_notes(
    State(_state): State<AppState>,
    Path(_note_id): Path<Uuid>,
) -> Result<Json<SearchResponse>, StatusCode> {
    // This would find related notes based on the note's content and tags
    // For now, return empty results
    Ok(Json(SearchResponse { notes: vec![] }))
}