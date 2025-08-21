use axum::{extract::{State, Path}, Json};
use uuid::Uuid;
use crate::{db, db::AppState, models::*};

pub async fn create_note(State(state): State<AppState>, Json(req): Json<CreateNoteRequest>) -> Result<Json<CreateNoteResponse>, axum::http::StatusCode> {
    let format = req.format.unwrap_or_else(|| "markdown".to_string());
    let source = req.source.unwrap_or_else(|| "manual".to_string());
    let id = db::insert_note(&state, &req.content, &format, &source).await.map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(CreateNoteResponse{ noteId: id }))
}

pub async fn get_note(State(state): State<AppState>, Path(id): Path<Uuid>) -> Result<Json<NoteFull>, axum::http::StatusCode> {
    let note = db::fetch_note(&state, id).await.map_err(|_| axum::http::StatusCode::NOT_FOUND)?;
    Ok(Json(note))
}

pub async fn put_revised(State(state): State<AppState>, Path(id): Path<Uuid>, Json(req): Json<PutRevisedRequest>) -> Result<Json<PutRevisedResponse>, axum::http::StatusCode> {
    let rev = db::update_revised(&state, id, &req.content, req.rationale.as_deref()).await.map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(PutRevisedResponse{ revisionId: rev, revisedContent: req.content }))
}
