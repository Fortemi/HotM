use axum::{extract::{State, Query, Path}, Json};
use serde::{Deserialize, Serialize};
use crate::{db, db::AppState, models::*};
use uuid::Uuid;
use std::collections::HashSet;

// Helper function to safely truncate strings at UTF-8 character boundaries
fn safe_truncate(s: &str, max_len: usize) -> &str {
    if s.len() <= max_len {
        return s;
    }
    
    // Find the nearest character boundary before or at max_len
    let mut end = max_len;
    while !s.is_char_boundary(end) && end > 0 {
        end -= 1;
    }
    
    &s[..end]
}

// Calculate metadata overlap score between two notes
fn calculate_metadata_overlap(source_meta: &serde_json::Value, target_meta: &serde_json::Value) -> f32 {
    let mut total_score = 0.0;
    let mut total_weight = 0.0;
    
    // Extract categories and topics
    let source_categories = extract_metadata_field(source_meta, "categories");
    let target_categories = extract_metadata_field(target_meta, "categories");
    
    let source_topics = extract_metadata_field(source_meta, "topics");
    let target_topics = extract_metadata_field(target_meta, "topics");
    
    // Categories are weighted more heavily (50% threshold for same category)
    if !source_categories.is_empty() && !target_categories.is_empty() {
        let category_overlap = calculate_set_overlap(&source_categories, &target_categories);
        // Same category requires 50% overlap
        if category_overlap >= 0.5 {
            total_score += category_overlap;
            total_weight += 1.0;
        }
    }
    
    // Topics require 33% overlap for different categories
    if !source_topics.is_empty() && !target_topics.is_empty() {
        let topic_overlap = calculate_set_overlap(&source_topics, &target_topics);
        // Different categories require 33% topic overlap
        if topic_overlap >= 0.33 {
            total_score += topic_overlap;
            total_weight += 1.0;
        }
    }
    
    // Extract entities and calculate their overlap
    if let (Some(source_entities), Some(target_entities)) = (source_meta.get("entities"), target_meta.get("entities")) {
        let entity_types = ["people", "organizations", "technologies", "locations"];
        for entity_type in &entity_types {
            let source_set = extract_entity_field(source_entities, entity_type);
            let target_set = extract_entity_field(target_entities, entity_type);
            
            if !source_set.is_empty() && !target_set.is_empty() {
                let overlap = calculate_set_overlap(&source_set, &target_set);
                total_score += overlap * 0.5; // Entities have lower weight
                total_weight += 0.5;
            }
        }
    }
    
    if total_weight > 0.0 {
        total_score / total_weight
    } else {
        0.0
    }
}

fn extract_metadata_field(meta: &serde_json::Value, field: &str) -> HashSet<String> {
    meta.get(field)
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(|s| s.to_lowercase()))
                .collect()
        })
        .unwrap_or_default()
}

fn extract_entity_field(entities: &serde_json::Value, field: &str) -> HashSet<String> {
    entities.get(field)
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(|s| s.to_lowercase()))
                .collect()
        })
        .unwrap_or_default()
}

fn calculate_set_overlap(set1: &HashSet<String>, set2: &HashSet<String>) -> f32 {
    if set1.is_empty() || set2.is_empty() {
        return 0.0;
    }
    
    let intersection: HashSet<_> = set1.intersection(set2).collect();
    let union: HashSet<_> = set1.union(set2).collect();
    
    intersection.len() as f32 / union.len() as f32
}

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
        "vector" | "semantic" => {
            let vecs = match crate::ollama::embed_texts(vec![params.q.clone()], &state.embed_model).await {
                Ok(v) => v,
                Err(e) => {
                    tracing::warn!("Embedding failed, falling back to FTS: {}", e);
                    // Fall back to FTS if embedding fails
                    let hits = db::search_fts_filtered(&state, &params.q, filters, 25).await.map_err(|e| {
                        tracing::error!("FTS fallback also failed: {:?}", e);
                        axum::http::StatusCode::INTERNAL_SERVER_ERROR
                    })?;
                    return Ok(Json(SearchResponse{ notes: hits }));
                }
            };
            let query_vec = vecs.into_iter().next().unwrap_or_else(|| vec![0.0_f32; 768]);
            let hits = db::search_vector_filtered(&state, query_vec, filters, 25).await.map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
            Ok(Json(SearchResponse{ notes: hits }))
        },
        _ => {
            // hybrid: fts + vector + RRF
            let fts_hits = db::search_fts_filtered(&state, &params.q, filters, 50).await.map_err(|e| {
                tracing::error!("FTS search error in hybrid: {:?}", e);
                axum::http::StatusCode::INTERNAL_SERVER_ERROR
            })?;
            
            // Try to get vector results, but don't fail if embeddings are unavailable
            let vec_hits = match crate::ollama::embed_texts(vec![params.q.clone()], &state.embed_model).await {
                Ok(vecs) => {
                    let query_vec = vecs.into_iter().next().unwrap_or_else(|| vec![0.0_f32; 768]);
                    db::search_vector_filtered(&state, query_vec, filters, 50).await.unwrap_or_else(|e| {
                        tracing::warn!("Vector search failed in hybrid, using FTS only: {}", e);
                        vec![]
                    })
                },
                Err(e) => {
                    tracing::warn!("Embedding failed in hybrid search, using FTS only: {}", e);
                    vec![]
                }
            };
            
            let notes = if vec_hits.is_empty() {
                // Just use FTS results if vector search failed
                fts_hits.into_iter().take(25).collect()
            } else {
                rrf_fuse(fts_hits, vec_hits, 25)
            };
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
    // Get the note with full metadata
    let note = db::fetch_note(&state, note_id)
        .await
        .map_err(|_| axum::http::StatusCode::NOT_FOUND)?;
    
    // Get the content to analyze (prefer revised content if available)
    let content = &note.revised.content;
    
    // Extract metadata for comparison
    let source_metadata = if let Some(ai_meta) = &note.revised.ai_metadata {
        ai_meta.clone()
    } else {
        serde_json::json!({})
    };
    
    // Generate embedding for the note content
    let vecs = crate::ollama::embed_texts(vec![content.clone()], &state.embed_model)
        .await
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
    let content_vec = vecs.into_iter().next().unwrap_or_else(|| vec![0.0_f32; 768]);
    
    // Find similar notes using vector search (get more candidates for metadata filtering)
    let vector_results = db::search_vector_filtered(&state, content_vec.clone(), None, 25)
        .await
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
    
    // Deduplicate and score based on both vector similarity and metadata overlap
    let mut seen_notes = std::collections::HashSet::new();
    let mut scored_notes = Vec::new();
    
    for hit in vector_results {
        if hit.note_id == note_id || !seen_notes.insert(hit.note_id) {
            continue; // Skip current note and duplicates
        }
        
        // Fetch note metadata for scoring
        if let Ok(related_note) = db::fetch_note(&state, hit.note_id).await {
            let mut final_score = hit.score * 0.7; // 70% weight for semantic similarity
            
            // Calculate metadata overlap score
            if let Some(related_ai_meta) = &related_note.revised.ai_metadata {
                let metadata_score = calculate_metadata_overlap(&source_metadata, related_ai_meta);
                final_score += metadata_score * 0.3; // 30% weight for metadata overlap
            }
            
            // Add tag overlap bonus
            let tag_overlap = note.tags.iter()
                .filter(|tag| related_note.tags.contains(tag))
                .count() as f32 / note.tags.len().max(1) as f32;
            final_score += tag_overlap * 0.1; // Bonus for tag overlap
            
            scored_notes.push(SearchHit {
                note_id: hit.note_id,
                score: final_score,
                snippet: Some(safe_truncate(&related_note.revised.content, 150).to_string()),
            });
        }
    }
    
    // Sort by final score and take top 5
    scored_notes.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
    let similar_notes: Vec<SearchHit> = scored_notes.into_iter().take(5).collect();
    
    // Generate context summary if there are related notes
    let context_summary = if !similar_notes.is_empty() {
        // Get the content of related notes for context analysis
        let mut related_content = Vec::new();
        for hit in &similar_notes {
            if let Ok(related_note) = db::fetch_note(&state, hit.note_id).await {
                // Safe string truncation that respects UTF-8 boundaries
                let snippet = safe_truncate(&related_note.revised.content, 500);
                related_content.push(format!("- {}", snippet));
            }
        }
        
        // Use LLM to generate context summary
        let content_snippet = safe_truncate(content, 1000);
        let prompt = format!(
            r#"Analyze how this note relates to other notes in the knowledge base:

Current Note:
{}

Related Notes (snippets):
{}

Provide a brief summary (2-3 sentences) explaining how this note fits into the broader context of the user's knowledge base. Focus on themes, connections, and patterns."#,
            content_snippet,
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

#[derive(Deserialize)]
pub struct GenerateContextRequest {
    pub query: String,
    pub hits: Vec<SearchHit>,
}

#[derive(Serialize)]
pub struct GenerateContextResponse {
    pub context: String,
}

pub async fn generate_search_context(
    State(state): State<AppState>,
    Json(req): Json<GenerateContextRequest>
) -> Result<Json<GenerateContextResponse>, axum::http::StatusCode> {
    if req.hits.is_empty() {
        return Ok(Json(GenerateContextResponse {
            context: "No search results to analyze.".to_string(),
        }));
    }

    // Get note content for the top results
    let mut note_contents = Vec::new();
    for hit in req.hits.iter().take(5) {
        if let Ok(note) = db::fetch_note(&state, hit.note_id).await {
            let content_snippet = safe_truncate(&note.revised.content, 500);
            note_contents.push(format!("- {}", content_snippet));
        }
    }

    let prompt = format!(
        r#"You are an intelligent search assistant. Analyze the following search query and results to provide a helpful context summary.

Search Query: "{}"

Found {} relevant notes:
{}

Provide a 2-3 sentence summary that:
1. Explains what themes or topics the search results cover
2. Highlights any connections or patterns between the notes
3. Gives the user insight into what they can discover in these results

Keep it concise and actionable."#,
        req.query,
        req.hits.len(),
        note_contents.join("\n")
    );

    match crate::ollama::generate(&state.gen_model, &prompt).await {
        Ok(context) => Ok(Json(GenerateContextResponse { context })),
        Err(e) => {
            tracing::warn!("Failed to generate search context: {}", e);
            Ok(Json(GenerateContextResponse {
                context: format!("Found {} notes related to '{}'. Click to explore the results.", req.hits.len(), req.query),
            }))
        }
    }
}
