use crate::db::AppState;
use axum::{extract::State, Json};
use serde::Serialize;
use uuid::Uuid;

#[derive(Serialize)]
pub struct DebugInfo {
    pub total_notes: i64,
    pub notes_with_revisions: i64,
    pub total_revisions: i64,
    pub recent_revisions: Vec<RevisionInfo>,
    pub embedding_count: i64,
}

#[derive(Serialize)]
pub struct RevisionInfo {
    pub note_id: Uuid,
    pub revision_id: Uuid,
    pub created_at: String,
    pub revision_type: String,
    pub content_preview: String,
}

pub async fn debug_revisions(
    State(state): State<AppState>,
) -> Result<Json<DebugInfo>, axum::http::StatusCode> {
    // Count total notes
    let total_notes = sqlx::query!("SELECT COUNT(*) as count FROM note")
        .fetch_one(&state.pool)
        .await
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?
        .count
        .unwrap_or(0);

    // Count notes with revisions
    let notes_with_revisions =
        sqlx::query!("SELECT COUNT(DISTINCT note_id) as count FROM note_revision")
            .fetch_one(&state.pool)
            .await
            .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?
            .count
            .unwrap_or(0);

    // Count total revisions
    let total_revisions = sqlx::query!("SELECT COUNT(*) as count FROM note_revision")
        .fetch_one(&state.pool)
        .await
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?
        .count
        .unwrap_or(0);

    // Get recent revisions
    let recent_revisions_raw = sqlx::query!(
        r#"
        SELECT id, note_id, type, created_at_utc, content 
        FROM note_revision 
        ORDER BY created_at_utc DESC 
        LIMIT 5
        "#
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;

    let recent_revisions: Vec<RevisionInfo> = recent_revisions_raw
        .into_iter()
        .map(|r| RevisionInfo {
            note_id: r.note_id,
            revision_id: r.id,
            created_at: r.created_at_utc.to_string(),
            revision_type: r.r#type,
            content_preview: r.content.chars().take(100).collect::<String>() + "...",
        })
        .collect();

    // Count embeddings
    let embedding_count = sqlx::query!("SELECT COUNT(*) as count FROM embedding")
        .fetch_one(&state.pool)
        .await
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?
        .count
        .unwrap_or(0);

    Ok(Json(DebugInfo {
        total_notes,
        notes_with_revisions,
        total_revisions,
        recent_revisions,
        embedding_count,
    }))
}
