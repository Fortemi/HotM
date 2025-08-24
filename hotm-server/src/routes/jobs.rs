//! Job queue management endpoints

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use hotm_core::{
    job_queue::queue::JobType,
    models::*,
};
use serde::Deserialize;
use serde_json::Value;
use uuid::Uuid;

use crate::app_state::AppState;

#[derive(Deserialize)]
pub struct QueueJobRequest {
    pub note_id: Option<Uuid>,
    pub job_type: String,
    pub priority: Option<i32>,
}

pub async fn queue_job(
    State(state): State<AppState>,
    Json(req): Json<QueueJobRequest>,
) -> Result<Json<Value>, StatusCode> {
    let job_type = match req.job_type.as_str() {
        "ai_revision" => JobType::AiRevision,
        "embedding" => JobType::Embedding,
        "linking" => JobType::Linking,
        "title_generation" => JobType::TitleGeneration,
        "context_update" => JobType::ContextUpdate,
        _ => return Err(StatusCode::BAD_REQUEST),
    };
    
    let priority = req.priority.unwrap_or(5);
    
    match state.job_queue.queue_job(req.note_id, job_type, priority, None).await {
        Ok(job_id) => Ok(Json(serde_json::json!({ "job_id": job_id }))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

pub async fn get_queue_status(
    State(state): State<AppState>,
) -> Result<Json<Vec<Value>>, StatusCode> {
    match state.job_queue.get_queue_status().await {
        Ok(status) => Ok(Json(status)),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

pub async fn get_job_status(
    State(_state): State<AppState>,
    Path(_job_id): Path<Uuid>,
) -> Result<Json<Job>, StatusCode> {
    // This would need to be implemented in the JobQueue trait
    Err(StatusCode::NOT_IMPLEMENTED)
}

pub async fn cancel_job(
    State(state): State<AppState>,
    Path(job_id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    match state.job_queue.cancel_job(job_id).await {
        Ok(_) => Ok(StatusCode::OK),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

pub async fn get_note_jobs(
    State(_state): State<AppState>,
    Path(_note_id): Path<Uuid>,
) -> Result<Json<Vec<Job>>, StatusCode> {
    // This would need to be implemented in the JobQueue trait
    Ok(Json(vec![]))
}