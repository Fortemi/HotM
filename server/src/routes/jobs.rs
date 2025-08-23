use axum::{extract::{State, Path}, Json, http::StatusCode};
use uuid::Uuid;
use crate::{db::AppState, job_queue};
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct QueueJobRequest {
    pub note_id: Option<Uuid>,
    pub job_type: job_queue::JobType,
    pub priority: Option<i32>,
    pub payload: Option<serde_json::Value>,
}

#[derive(Debug, Serialize)]
pub struct QueueJobResponse {
    pub job_id: Uuid,
    pub estimated_duration_ms: i32,
    pub queue_position: i32,
}

/// Queue a new job
pub async fn queue_job(
    State(state): State<AppState>,
    Json(req): Json<QueueJobRequest>,
) -> Result<Json<QueueJobResponse>, StatusCode> {
    let priority = req.priority.unwrap_or(5);
    
    // Queue the job
    let job_id = job_queue::queue_job(
        &state.pool,
        req.note_id,
        req.job_type,
        priority,
        req.payload,
    )
    .await
    .map_err(|e| {
        tracing::error!("Failed to queue job: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Get queue position
    let position = sqlx::query_scalar!(
        r#"
        SELECT COUNT(*)::INT as count
        FROM job_queue
        WHERE status = 'pending'::job_status
        AND created_at < (SELECT created_at FROM job_queue WHERE id = $1)
        "#,
        job_id
    )
    .fetch_one(&state.pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .unwrap_or(0);

    // Get estimated duration
    let estimated_duration = sqlx::query_scalar!(
        "SELECT estimated_duration_ms FROM job_queue WHERE id = $1",
        job_id
    )
    .fetch_one(&state.pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .unwrap_or(10000);

    Ok(Json(QueueJobResponse {
        job_id,
        estimated_duration_ms: estimated_duration,
        queue_position: position,
    }))
}

/// Get job queue status
pub async fn get_queue_status(
    State(state): State<AppState>,
) -> Result<Json<Vec<serde_json::Value>>, StatusCode> {
    let status = job_queue::get_queue_status(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get queue status: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(status))
}

/// Get job status by ID
pub async fn get_job_status(
    State(state): State<AppState>,
    Path(job_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let job = sqlx::query!(
        r#"
        SELECT 
            id,
            note_id,
            job_type as "job_type: job_queue::JobType",
            status as "status: job_queue::JobStatus",
            progress_percent,
            error_message,
            estimated_duration_ms,
            actual_duration_ms,
            created_at,
            started_at,
            completed_at
        FROM job_queue
        WHERE id = $1
        "#,
        job_id
    )
    .fetch_optional(&state.pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(serde_json::json!({
        "id": job.id,
        "note_id": job.note_id,
        "job_type": job.job_type,
        "status": job.status,
        "progress_percent": job.progress_percent,
        "error_message": job.error_message,
        "estimated_duration_ms": job.estimated_duration_ms,
        "actual_duration_ms": job.actual_duration_ms,
        "created_at": job.created_at,
        "started_at": job.started_at,
        "completed_at": job.completed_at,
    })))
}

/// Cancel a job
pub async fn cancel_job(
    State(state): State<AppState>,
    Path(job_id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    job_queue::cancel_job(&state.pool, job_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to cancel job: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(StatusCode::NO_CONTENT)
}

/// Get jobs for a specific note
pub async fn get_note_jobs(
    State(state): State<AppState>,
    Path(note_id): Path<Uuid>,
) -> Result<Json<Vec<serde_json::Value>>, StatusCode> {
    let jobs = sqlx::query!(
        r#"
        SELECT 
            id,
            job_type as "job_type: job_queue::JobType",
            status as "status: job_queue::JobStatus",
            progress_percent,
            created_at
        FROM job_queue
        WHERE note_id = $1
        ORDER BY created_at DESC
        LIMIT 10
        "#,
        note_id
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let result: Vec<serde_json::Value> = jobs
        .into_iter()
        .map(|job| {
            serde_json::json!({
                "id": job.id,
                "job_type": job.job_type,
                "status": job.status,
                "progress_percent": job.progress_percent,
                "created_at": job.created_at,
            })
        })
        .collect();

    Ok(Json(result))
}