use axum::{extract::{State, Path, Query}, Json};
use uuid::Uuid;
use crate::{db, db::AppState, models::*};
use serde_json;

pub async fn create_note(State(state): State<AppState>, Json(req): Json<CreateNoteRequest>) -> Result<Json<CreateNoteResponse>, axum::http::StatusCode> {
    let format = req.format.unwrap_or_else(|| "markdown".to_string());
    let source = req.source.unwrap_or_else(|| "manual".to_string());
    let id = db::insert_note(&state, &req.content, &format, &source).await.map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(CreateNoteResponse{ note_id: id }))
}

pub async fn get_note(State(state): State<AppState>, Path(id): Path<Uuid>) -> Result<Json<NoteFull>, axum::http::StatusCode> {
    let note = db::fetch_note(&state, id).await.map_err(|_| axum::http::StatusCode::NOT_FOUND)?;
    Ok(Json(note))
}

pub async fn put_revised(State(state): State<AppState>, Path(id): Path<Uuid>, Json(req): Json<PutRevisedRequest>) -> Result<Json<PutRevisedResponse>, axum::http::StatusCode> {
    let rev = db::update_revised(&state, id, &req.content, req.rationale.as_deref()).await.map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(PutRevisedResponse{ revision_id: rev, revised_content: req.content }))
}

// List all notes with filtering and sorting
pub async fn list_notes(State(state): State<AppState>, Query(params): Query<ListNotesRequest>) -> Result<Json<ListNotesResponse>, axum::http::StatusCode> {
    let response = db::list_notes(&state, &params).await
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(response))
}

// Update note status (star/archive)
pub async fn update_note_status(State(state): State<AppState>, Path(id): Path<Uuid>, Json(req): Json<UpdateNoteStatusRequest>) -> Result<Json<serde_json::Value>, axum::http::StatusCode> {
    db::update_note_status(&state, id, &req).await
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({
        "status": "updated",
        "note_id": id
    })))
}

// Endpoint to regenerate AI enhancement for a note
pub async fn regenerate_ai(State(state): State<AppState>, Path(id): Path<Uuid>) -> Result<Json<serde_json::Value>, axum::http::StatusCode> {
    // Get the current note content
    let note = db::fetch_note(&state, id).await
        .map_err(|_| axum::http::StatusCode::NOT_FOUND)?;
    
    // Trigger AI regeneration with metadata in the background
    let state_clone = state.clone();
    let content = note.original.content.clone();
    tokio::spawn(async move {
        if let Err(err) = crate::db_enhanced::generate_ai_revision_with_metadata(&state_clone, id, &content).await {
            eprintln!("Failed to generate AI revision: {}", err);
        }
    });
    
    Ok(Json(serde_json::json!({
        "status": "regenerating",
        "note_id": id
    })))
}
