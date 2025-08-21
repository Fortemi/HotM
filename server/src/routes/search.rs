use axum::{extract::{State, Query}, Json};
use serde::Deserialize;
use crate::{db, db::AppState, models::*};
use axum::Json;
use uuid::Uuid;

#[derive(Deserialize)]
pub struct SearchParams { pub q: String, pub mode: Option<String>, pub filters: Option<String> }

pub async fn search(State(state): State<AppState>, Query(params): Query<SearchParams>) -> Result<Json<SearchResponse>, axum::http::StatusCode> {
    let hits = db::search_fts(&state, &params.q, 25).await.map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(SearchResponse{ hits }))
}

pub async fn semantic(State(state): State<AppState>, Json(req): Json<SemanticRequest>) -> Result<Json<SemanticResponse>, axum::http::StatusCode> {
    // Get embedding for the input text
    let vecs = crate::ollama::embed_texts(vec![req.text.clone()], &state.embed_model)
        .await.map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
    let query_vec = vecs.into_iter().next().unwrap_or_else(|| vec![0.0_f32; 768]);
    let hits = crate::db::search_vector(&state, query_vec, 25).await.map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(SemanticResponse { similar: hits }))
}
