use axum::{extract::{State, Query, Path}, Json};
use serde::{Deserialize, Serialize};
use crate::{db, db::AppState, models::*};
use uuid::Uuid;

#[derive(Deserialize)]
pub struct SearchParams { pub q: String, pub mode: Option<String>, pub filters: Option<String> }

pub async fn search(State(state): State<AppState>, Query(params): Query<SearchParams>) -> Result<Json<SearchResponse>, axum::http::StatusCode> {
    let mode = params.mode.as_deref().unwrap_or("hybrid");
    let filters = params.filters.as_deref();
    tracing::info!("Search request: q={}, mode={}, filters={:?}", params.q, mode, filters);
    match mode {
        "fts" => {
            let hits = db::search_fts_filtered(&state, &params.q, filters, 25).await.map_err(|e| {
                tracing::error!("FTS search error: {:?}", e);
                axum::http::StatusCode::INTERNAL_SERVER_ERROR
            })?;
            Ok(Json(SearchResponse{ notes: hits }))
        },
        "vector" => {
            let vecs = crate::ollama::embed_texts(vec![params.q.clone()], &state.embed_model)
                .await.map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
            let query_vec = vecs.into_iter().next().unwrap_or_else(|| vec![0.0_f32; 768]);
            let hits = db::search_vector_filtered(&state, query_vec, filters, 25).await.map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
            Ok(Json(SearchResponse{ notes: hits }))
        },
        _ => {
            // hybrid: fts + vector + RRF
            let vecs = crate::ollama::embed_texts(vec![params.q.clone()], &state.embed_model)
                .await.map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
            let query_vec = vecs.into_iter().next().unwrap_or_else(|| vec![0.0_f32; 768]);
            let fts_hits = db::search_fts_filtered(&state, &params.q, filters, 50).await.map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
            let vec_hits = db::search_vector_filtered(&state, query_vec, filters, 50).await.map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
            let notes = rrf_fuse(fts_hits, vec_hits, 25);
            Ok(Json(SearchResponse{ notes }))
        }
    }
}

pub async fn semantic(State(state): State<AppState>, Json(req): Json<SemanticRequest>) -> Result<Json<SemanticResponse>, axum::http::StatusCode> {
    // Get embedding for the input text
    let vecs = crate::ollama::embed_texts(vec![req.text.clone()], &state.embed_model)
        .await.map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
    let query_vec = vecs.into_iter().next().unwrap_or_else(|| vec![0.0_f32; 768]);
    let notes = crate::db::search_vector_filtered(&state, query_vec, None, 25).await.map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(SemanticResponse { similar: notes }))
}

#[derive(Serialize)]
pub struct RelatedNotesResponse {
    pub related: Vec<SearchHit>,
    pub context_summary: Option<String>,
}

pub async fn find_related_notes(
    State(state): State<AppState>,
    Path(note_id): Path<Uuid>
) -> Result<Json<RelatedNotesResponse>, axum::http::StatusCode> {
    // Get the note content
    let note = db::fetch_note(&state, note_id)
        .await
        .map_err(|_| axum::http::StatusCode::NOT_FOUND)?;
    
    // Get the content to analyze (prefer revised content if available)
    let content = &note.revised.content;
    
    // Generate embedding for the note content
    let vecs = crate::ollama::embed_texts(vec![content.clone()], &state.embed_model)
        .await
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
    let content_vec = vecs.into_iter().next().unwrap_or_else(|| vec![0.0_f32; 768]);
    
    // Find similar notes using vector search (excluding the current note)
    let mut similar_notes = db::search_vector_filtered(&state, content_vec.clone(), None, 10)
        .await
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
    
    // Filter out the current note
    similar_notes.retain(|hit| hit.note_id != note_id);
    
    // Take top 5 related notes
    similar_notes.truncate(5);
    
    // Generate context summary if there are related notes
    let context_summary = if !similar_notes.is_empty() {
        // Get the content of related notes for context analysis
        let mut related_content = Vec::new();
        for hit in &similar_notes {
            if let Ok(related_note) = db::fetch_note(&state, hit.note_id).await {
                let snippet = &related_note.revised.content[..related_note.revised.content.len().min(500)];
                related_content.push(format!("- {}", snippet));
            }
        }
        
        // Use LLM to generate context summary
        let prompt = format!(
            r#"Analyze how this note relates to other notes in the knowledge base:

Current Note:
{}

Related Notes (snippets):
{}

Provide a brief summary (2-3 sentences) explaining how this note fits into the broader context of the user's knowledge base. Focus on themes, connections, and patterns."#,
            &content[..content.len().min(1000)],
            related_content.join("\n")
        );
        
        match crate::ollama::generate(&state.gen_model, &prompt).await {
            Ok(summary) => Some(summary),
            Err(_) => None
        }
    } else {
        None
    };
    
    Ok(Json(RelatedNotesResponse {
        related: similar_notes,
        context_summary,
    }))
}

fn rrf_fuse(a: Vec<SearchHit>, b: Vec<SearchHit>, limit: usize) -> Vec<SearchHit> {
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
