//! Notes API endpoints

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use hotm_core::{
    job_queue::queue::JobType,
    models::*,
};
use serde_json::Value;
use uuid::Uuid;

use crate::app_state::AppState;

pub async fn create_note(
    State(state): State<AppState>,
    Json(req): Json<CreateNoteRequest>,
) -> Result<Json<CreateNoteResponse>, StatusCode> {
    let format = req.format.as_deref().unwrap_or("markdown");
    let source = req.source.as_deref().unwrap_or("api");

    match state.note_repository.create_note(&req.content, format, source).await {
        Ok(note_id) => {
            // Queue background jobs for the new note
            let _ = state.job_queue.queue_job(Some(note_id), JobType::AiRevision, 8, None).await;
            let _ = state.job_queue.queue_job(Some(note_id), JobType::Embedding, 5, None).await;
            let _ = state.job_queue.queue_job(Some(note_id), JobType::Linking, 3, None).await;
            let _ = state.job_queue.queue_job(Some(note_id), JobType::TitleGeneration, 2, None).await;
            
            Ok(Json(CreateNoteResponse { note_id }))
        }
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

pub async fn get_note(
    State(state): State<AppState>,
    Path(note_id): Path<Uuid>,
) -> Result<Json<NoteFull>, StatusCode> {
    match state.note_repository.get_note(note_id).await {
        Ok(Some(note)) => Ok(Json(note)),
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

pub async fn list_notes(
    State(state): State<AppState>,
    Query(req): Query<ListNotesRequest>,
) -> Result<Json<ListNotesResponse>, StatusCode> {
    match state.note_repository.list_notes(&req).await {
        Ok(response) => Ok(Json(response)),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

pub async fn delete_note(
    State(state): State<AppState>,
    Path(note_id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    match state.note_repository.delete_note(note_id).await {
        Ok(_) => Ok(StatusCode::NO_CONTENT),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

pub async fn update_note_status(
    State(state): State<AppState>,
    Path(note_id): Path<Uuid>,
    Json(req): Json<UpdateNoteStatusRequest>,
) -> Result<StatusCode, StatusCode> {
    match state.note_repository.update_note_status(note_id, &req).await {
        Ok(_) => Ok(StatusCode::OK),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

pub async fn put_revised(
    State(state): State<AppState>,
    Path(note_id): Path<Uuid>,
    Json(req): Json<PutRevisedRequest>,
) -> Result<Json<PutRevisedResponse>, StatusCode> {
    match state.note_repository.update_revised(note_id, &req.content, req.rationale.as_deref()).await {
        Ok(revision_id) => Ok(Json(PutRevisedResponse {
            revision_id,
            revised_content: req.content,
        })),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

pub async fn update_note_title(
    State(_state): State<AppState>,
    Path(_note_id): Path<Uuid>,
    Json(_req): Json<UpdateNoteTitleRequest>,
) -> Result<StatusCode, StatusCode> {
    // For now, we'll use a simple database update
    // This functionality might need to be added to the NoteRepository trait
    Ok(StatusCode::NOT_IMPLEMENTED)
}

pub async fn update_original_content(
    State(state): State<AppState>,
    Path(note_id): Path<Uuid>,
    Json(req): Json<UpdateOriginalContentRequest>,
) -> Result<StatusCode, StatusCode> {
    match state.note_repository.update_original_content(note_id, &req.content).await {
        Ok(_) => {
            // Queue re-processing jobs
            let _ = state.job_queue.queue_job(Some(note_id), JobType::AiRevision, 8, None).await;
            let _ = state.job_queue.queue_job(Some(note_id), JobType::Embedding, 5, None).await;
            let _ = state.job_queue.queue_job(Some(note_id), JobType::Linking, 3, None).await;
            
            Ok(StatusCode::OK)
        }
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

pub async fn regenerate_ai(
    State(state): State<AppState>,
    Path(note_id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    // Queue AI regeneration with high priority
    match state.job_queue.queue_job(Some(note_id), JobType::AiRevision, 10, None).await {
        Ok(_) => Ok(StatusCode::ACCEPTED),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

// Placeholder implementations for metadata labels
pub async fn get_metadata_labels(
    State(_state): State<AppState>,
    Path(_note_id): Path<Uuid>,
) -> Result<Json<Vec<UserMetadataLabel>>, StatusCode> {
    // This would need to be implemented in the repository trait
    Ok(Json(vec![]))
}

pub async fn add_metadata_label(
    State(_state): State<AppState>,
    Path(_note_id): Path<Uuid>,
    Json(_req): Json<AddMetadataLabelRequest>,
) -> Result<Json<UserMetadataLabel>, StatusCode> {
    Err(StatusCode::NOT_IMPLEMENTED)
}

pub async fn remove_metadata_label(
    State(_state): State<AppState>,
    Path(_note_id): Path<Uuid>,
    Path(_label_id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    Err(StatusCode::NOT_IMPLEMENTED)
}

pub async fn get_all_labels(
    State(_state): State<AppState>,
) -> Result<Json<Vec<String>>, StatusCode> {
    // This would need to be implemented in the repository trait
    Ok(Json(vec![]))
}

pub async fn create_note_link(
    State(_state): State<AppState>,
    Path(_note_id): Path<Uuid>,
    Json(_req): Json<CreateLinkRequest>,
) -> Result<Json<Value>, StatusCode> {
    // This would need to be implemented in the repository trait or a separate service
    Err(StatusCode::NOT_IMPLEMENTED)
}