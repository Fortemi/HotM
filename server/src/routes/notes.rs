use axum::{extract::{State, Path, Query}, Json};
use uuid::Uuid;
use chrono::Utc;
use crate::{db, db::AppState, models::*};
use serde_json;

pub async fn create_note(State(state): State<AppState>, Json(req): Json<CreateNoteRequest>) -> Result<Json<CreateNoteResponse>, axum::http::StatusCode> {
    let format = req.format.unwrap_or_else(|| "markdown".to_string());
    let source = req.source.unwrap_or_else(|| "manual".to_string());
    let id = db::insert_note(&state, &req.content, &format, &source).await.map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(CreateNoteResponse{ note_id: id }))
}

pub async fn get_note(State(state): State<AppState>, Path(id): Path<Uuid>) -> Result<Json<NoteFull>, axum::http::StatusCode> {
    // Update access tracking
    sqlx::query!("SELECT update_note_access($1)", id)
        .execute(&state.pool)
        .await
        .ok(); // Ignore errors on access tracking
        
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

// Delete a note
pub async fn delete_note(State(state): State<AppState>, Path(id): Path<Uuid>) -> Result<Json<serde_json::Value>, axum::http::StatusCode> {
    // Delete the note and all related data (CASCADE will handle related records)
    sqlx::query!("DELETE FROM note WHERE id = $1", id)
        .execute(&state.pool)
        .await
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
    
    Ok(Json(serde_json::json!({
        "status": "deleted",
        "note_id": id
    })))
}

// Add metadata label to a note
pub async fn add_metadata_label(
    State(state): State<AppState>, 
    Path(id): Path<Uuid>, 
    Json(req): Json<AddMetadataLabelRequest>
) -> Result<Json<UserMetadataLabel>, axum::http::StatusCode> {
    let label_id = Uuid::new_v4();
    let now = Utc::now();
    
    sqlx::query!(
        "INSERT INTO user_metadata_label (id, note_id, label, color, created_at) VALUES ($1, $2, $3, $4, $5)",
        label_id,
        id,
        req.label,
        req.color,
        now
    )
    .execute(&state.pool)
    .await
    .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
    
    Ok(Json(UserMetadataLabel {
        id: label_id,
        note_id: id,
        label: req.label,
        color: req.color,
        created_at: now,
    }))
}

// Get metadata labels for a note
pub async fn get_metadata_labels(
    State(state): State<AppState>, 
    Path(id): Path<Uuid>
) -> Result<Json<Vec<UserMetadataLabel>>, axum::http::StatusCode> {
    let labels = sqlx::query!(
        "SELECT id, note_id, label, color, created_at FROM user_metadata_label WHERE note_id = $1 ORDER BY created_at",
        id
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?
    .into_iter()
    .map(|row| UserMetadataLabel {
        id: row.id,
        note_id: row.note_id,
        label: row.label,
        color: row.color,
        created_at: row.created_at,
    })
    .collect();
    
    Ok(Json(labels))
}

// Remove metadata label
pub async fn remove_metadata_label(
    State(state): State<AppState>, 
    Path((note_id, label_id)): Path<(Uuid, Uuid)>
) -> Result<Json<serde_json::Value>, axum::http::StatusCode> {
    sqlx::query!(
        "DELETE FROM user_metadata_label WHERE id = $1 AND note_id = $2",
        label_id,
        note_id
    )
    .execute(&state.pool)
    .await
    .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
    
    Ok(Json(serde_json::json!({
        "status": "removed",
        "label_id": label_id
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

// Get all unique labels in the system
pub async fn get_all_labels(
    State(state): State<AppState>
) -> Result<Json<Vec<String>>, axum::http::StatusCode> {
    // Get all unique tags from both AI-generated and user-defined tags
    // Using the materialized view for better performance
    let labels = sqlx::query!(
        "SELECT tag FROM all_tags_view ORDER BY usage_count DESC, tag ASC LIMIT 100"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?
    .into_iter()
    .filter_map(|row| row.tag)
    .collect();
    
    Ok(Json(labels))
}

// Create a manual link between notes
pub async fn create_note_link(
    State(state): State<AppState>, 
    Path(id): Path<Uuid>, 
    Json(req): Json<CreateLinkRequest>
) -> Result<Json<serde_json::Value>, axum::http::StatusCode> {
    use chrono::Utc;
    
    let link_id = Uuid::new_v4();
    let result = sqlx::query!(
        "INSERT INTO link (id, from_note_id, to_note_id, kind, score, created_at_utc) 
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT DO NOTHING",
        link_id, id, req.to_note_id, "manual", 1.0_f32, Utc::now()
    )
    .execute(&state.pool)
    .await
    .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
    
    Ok(Json(serde_json::json!({
        "status": "created",
        "link_id": link_id,
        "from_note_id": id,
        "to_note_id": req.to_note_id,
        "rows_affected": result.rows_affected()
    })))
}
