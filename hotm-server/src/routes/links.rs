//! Link management endpoints

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use hotm_core::models::*;
use uuid::Uuid;

use crate::app_state::AppState;

pub async fn post_link(
    State(_state): State<AppState>,
    Path(_note_id): Path<Uuid>,
    Json(_req): Json<PostLinkRequest>,
) -> Result<Json<PostLinkResponse>, StatusCode> {
    Err(StatusCode::NOT_IMPLEMENTED)
}