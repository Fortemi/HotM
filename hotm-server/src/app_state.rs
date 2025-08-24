//! Application state management for the server

use hotm_core::{
    websocket::broadcaster::WsBroadcaster,
    database::db::{DatabasePool, NoteRepository},
    ollama::client::OllamaClient,
    job_queue::queue::JobQueue,
};
use std::sync::Arc;

#[derive(Clone)]
pub struct AppState {
    pub database: DatabasePool,
    pub ollama_client: OllamaClient,
    pub ws_broadcaster: WsBroadcaster,
    pub embed_model: String,
    #[allow(dead_code)]
    pub generation_model: String,
    pub note_repository: Arc<dyn NoteRepository>,
    pub job_queue: Arc<dyn JobQueue>,
}

impl AppState {
    pub fn new(
        database: DatabasePool,
        ollama_client: OllamaClient,
        ws_broadcaster: WsBroadcaster,
        embed_model: String,
        generation_model: String,
        note_repository: Arc<dyn NoteRepository>,
        job_queue: Arc<dyn JobQueue>,
    ) -> Self {
        Self {
            database,
            ollama_client,
            ws_broadcaster,
            embed_model,
            generation_model,
            note_repository,
            job_queue,
        }
    }
}