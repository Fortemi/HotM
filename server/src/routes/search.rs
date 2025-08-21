use axum::{extract::{State, Query}, Json};
use serde::Deserialize;
use crate::{db, db::AppState, models::*};

#[derive(Deserialize)]
pub struct SearchParams { pub q: String, pub mode: Option<String>, pub filters: Option<String> }

pub async fn search(State(state): State<AppState>, Query(params): Query<SearchParams>) -> Result<Json<SearchResponse>, axum::http::StatusCode> {
    let hits = db::search_fts(&state, &params.q, 25).await.map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(SearchResponse{ hits }))
}
