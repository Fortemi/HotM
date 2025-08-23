use axum::{extract::{State, Path}, Json};
use uuid::Uuid;
use crate::{db::AppState, models::*};

pub async fn get_provenance(State(state): State<AppState>, Path(id): Path<Uuid>) -> Result<Json<ProvenanceResponse>, axum::http::StatusCode> {
    let revs = sqlx::query!("SELECT id, parent_revision_id, created_at_utc FROM note_revision WHERE note_id = $1 ORDER BY created_at_utc ASC", id)
        .fetch_all(&state.pool).await.map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
    let edges = sqlx::query!("SELECT id, revision_id, source_note_id, source_url, relation, created_at_utc FROM provenance_edge WHERE revision_id IN (SELECT id FROM note_revision WHERE note_id = $1)", id)
        .fetch_all(&state.pool).await.map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
    let revisions = revs.into_iter().map(|r| RevisionNode{ id: r.id, parent_revision_id: r.parent_revision_id, created_at_utc: r.created_at_utc }).collect();
    let edges: Vec<ProvenanceEdge> = edges.into_iter().map(|e| ProvenanceEdge{ id: e.id, revision_id: e.revision_id.unwrap(), source_note_id: e.source_note_id, source_url: e.source_url, relation: e.relation, created_at_utc: e.created_at_utc }).collect();
    Ok(Json(ProvenanceResponse { revisions, edges }))
}
