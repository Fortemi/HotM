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
    // Simple vector similarity against embeddings table (requires pgvector index)
    let rows = sqlx::query!(
        r#"
        SELECT e.note_id AS note_id,
               1.0 - (e.vector <=> $1::vector) AS score
        FROM embedding e
        ORDER BY e.vector <=> $1::vector
        LIMIT 25
        "#,
        pgvector::Vector::from(vec![0.0_f32; 768])  -- placeholder until embeddings are computed
    ).fetch_all(&state.pool).await.map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;

    let hits: Vec<SearchHit> = rows.into_iter().map(|r| SearchHit{ note_id: r.note_id, score: r.score.unwrap_or(0.0) as f32, snippet: None }).collect();
    Ok(Json(SemanticResponse { similar: hits }))
}
