use axum::{extract::{State, Path}, Json};
use uuid::Uuid;
use crate::{db::AppState, models::*};

pub async fn post_link(State(state): State<AppState>, Path(id): Path<Uuid>, Json(req): Json<PostLinkRequest>) -> Result<Json<PostLinkResponse>, axum::http::StatusCode> {
    let link_id = Uuid::new_v4();
    let score_val = req.score.unwrap_or(0.9);
    sqlx::query!(
        "INSERT INTO link (id, from_note_id, to_note_id, to_url, kind, score, created_at_utc) VALUES ($1, $2, $3, $4, $5, $6::REAL, NOW())",
        link_id, id, req.to_note_id, req.to_url, req.kind, score_val
    ).execute(&state.pool).await.map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(PostLinkResponse{ link_id: link_id }))
}
