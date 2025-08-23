use axum::{extract::{State, Path}, Json};
use crate::{db::AppState, models::*};
use uuid::Uuid;
use chrono::Utc;

pub async fn create_tag(State(state): State<AppState>, Json(req): Json<CreateTagRequest>) -> Result<Json<CreateTagResponse>, axum::http::StatusCode> {
    sqlx::query!("INSERT INTO tag (name, created_at_utc) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING", req.name, Utc::now()).execute(&state.pool).await.map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(CreateTagResponse { name: req.name }))
}

pub async fn put_note_tags(State(state): State<AppState>, Path(id): Path<Uuid>, Json(req): Json<PutNoteTagsRequest>) -> Result<Json<PutNoteTagsResponse>, axum::http::StatusCode> {
    let mut tx = state.pool.begin().await.map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
    if let Some(add) = req.add.as_ref() {
        for t in add {
            sqlx::query!("INSERT INTO tag (name, created_at_utc) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING", t, Utc::now()).execute(&mut *tx).await.map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
            sqlx::query!("INSERT INTO note_tag (note_id, tag_name, source) VALUES ($1, $2, 'manual') ON CONFLICT DO NOTHING", id, t).execute(&mut *tx).await.map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
        }
    }
    if let Some(remove) = req.remove.as_ref() {
        for t in remove {
            sqlx::query!("DELETE FROM note_tag WHERE note_id = $1 AND tag_name = $2", id, t).execute(&mut *tx).await.map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
        }
    }
    tx.commit().await.map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
    let tags = sqlx::query!("SELECT tag_name FROM note_tag WHERE note_id = $1", id).fetch_all(&state.pool).await.map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?.into_iter().map(|r| r.tag_name).collect();
    Ok(Json(PutNoteTagsResponse{ tags }))
}

pub async fn create_collection(State(state): State<AppState>, Json(req): Json<CreateCollectionRequest>) -> Result<Json<CreateCollectionResponse>, axum::http::StatusCode> {
    let id = Uuid::new_v4();
    sqlx::query!("INSERT INTO collection (id, name, description) VALUES ($1, $2, $3)", id, req.name, req.description).execute(&state.pool).await.map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(CreateCollectionResponse { collection_id: id }))
}

pub async fn put_note_collection(State(state): State<AppState>, Path(id): Path<Uuid>, Json(req): Json<PutNoteCollectionRequest>) -> Result<Json<PutNoteCollectionResponse>, axum::http::StatusCode> {
    sqlx::query!("UPDATE note SET collection_id = $1 WHERE id = $2", req.collection_id, id).execute(&state.pool).await.map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(PutNoteCollectionResponse{ collection_id: req.collection_id }))
}
