use axum::{extract::{State, Query}, Json};
use serde::Deserialize;
use crate::{db, db::AppState, models::*};
use axum::Json;
use uuid::Uuid;

#[derive(Deserialize)]
pub struct SearchParams { pub q: String, pub mode: Option<String>, pub filters: Option<String> }

pub async fn search(State(state): State<AppState>, Query(params): Query<SearchParams>) -> Result<Json<SearchResponse>, axum::http::StatusCode> {
    let mode = params.mode.as_deref().unwrap_or("hybrid");
    let filters = params.filters.as_deref();
    match mode {
        "fts" => {
            let hits = db::search_fts_filtered(&state, &params.q, filters, 25).await.map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
            Ok(Json(SearchResponse{ hits }))
        }
        , "vector" => {
            let vecs = crate::ollama::embed_texts(vec![params.q.clone()], &state.embed_model)
                .await.map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
            let query_vec = vecs.into_iter().next().unwrap_or_else(|| vec![0.0_f32; 768]);
            let hits = db::search_vector_filtered(&state, query_vec, filters, 25).await.map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
            Ok(Json(SearchResponse{ hits }))
        }
        , _ => {
            // hybrid: fts + vector + RRF
            let vecs = crate::ollama::embed_texts(vec![params.q.clone()], &state.embed_model)
                .await.map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
            let query_vec = vecs.into_iter().next().unwrap_or_else(|| vec![0.0_f32; 768]);
            let fts_hits = db::search_fts_filtered(&state, &params.q, filters, 50).await.map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
            let vec_hits = db::search_vector_filtered(&state, query_vec, filters, 50).await.map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
            let hits = rrf_fuse(fts_hits, vec_hits, 25);
            Ok(Json(SearchResponse{ hits }))
        }
    }
}

pub async fn semantic(State(state): State<AppState>, Json(req): Json<SemanticRequest>) -> Result<Json<SemanticResponse>, axum::http::StatusCode> {
    // Get embedding for the input text
    let vecs = crate::ollama::embed_texts(vec![req.text.clone()], &state.embed_model)
        .await.map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
    let query_vec = vecs.into_iter().next().unwrap_or_else(|| vec![0.0_f32; 768]);
    let hits = crate::db::search_vector_filtered(&state, query_vec, None, 25).await.map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(SemanticResponse { similar: hits }))
}

fn rrf_fuse(mut a: Vec<SearchHit>, mut b: Vec<SearchHit>, limit: usize) -> Vec<SearchHit> {
    use std::collections::HashMap;
    let mut rank_a: HashMap<Uuid, usize> = HashMap::new();
    let mut rank_b: HashMap<Uuid, usize> = HashMap::new();
    for (i, hit) in a.iter().enumerate() { rank_a.insert(hit.note_id, i + 1); }
    for (i, hit) in b.iter().enumerate() { rank_b.insert(hit.note_id, i + 1); }
    let mut scores: HashMap<Uuid, f64> = HashMap::new();
    let k = 60.0;
    for (id, r) in &rank_a { *scores.entry(*id).or_insert(0.0) += 1.0 / (k + *r as f64); }
    for (id, r) in &rank_b { *scores.entry(*id).or_insert(0.0) += 1.0 / (k + *r as f64); }

    let mut combined: Vec<(Uuid, f64)> = scores.into_iter().collect();
    combined.sort_by(|x, y| y.1.partial_cmp(&x.1).unwrap());
    let mut out = Vec::new();
    for (id, score) in combined.into_iter().take(limit) {
        let snippet = a.iter().find(|h| h.note_id == id).and_then(|h| h.snippet.clone());
        out.push(SearchHit { note_id: id, score: score as f32, snippet });
    }
    out
}
