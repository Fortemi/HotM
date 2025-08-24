//! Provenance tracking endpoints

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use hotm_core::models::*;
use uuid::Uuid;

use crate::app_state::AppState;

pub async fn get_provenance(
    State(_state): State<AppState>,
    Path(_note_id): Path<Uuid>,
) -> Result<Json<ProvenanceResponse>, StatusCode> {
    // Return empty provenance data for now
    Ok(Json(ProvenanceResponse {
        revisions: vec![],
        edges: vec![],
    }))
}