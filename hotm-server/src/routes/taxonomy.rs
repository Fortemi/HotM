//! Taxonomy endpoints (tags and collections)

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use hotm_core::models::*;
use uuid::Uuid;

use crate::app_state::AppState;

pub async fn create_tag(
    State(_state): State<AppState>,
    Json(_req): Json<CreateTagRequest>,
) -> Result<Json<CreateTagResponse>, StatusCode> {
    Err(StatusCode::NOT_IMPLEMENTED)
}

pub async fn put_note_tags(
    State(_state): State<AppState>,
    Path(_note_id): Path<Uuid>,
    Json(_req): Json<PutNoteTagsRequest>,
) -> Result<Json<PutNoteTagsResponse>, StatusCode> {
    Err(StatusCode::NOT_IMPLEMENTED)
}

pub async fn create_collection(
    State(_state): State<AppState>,
    Json(_req): Json<CreateCollectionRequest>,
) -> Result<Json<CreateCollectionResponse>, StatusCode> {
    Err(StatusCode::NOT_IMPLEMENTED)
}

pub async fn put_note_collection(
    State(_state): State<AppState>,
    Path(_note_id): Path<Uuid>,
    Json(_req): Json<PutNoteCollectionRequest>,
) -> Result<Json<PutNoteCollectionResponse>, StatusCode> {
    Err(StatusCode::NOT_IMPLEMENTED)
}