//! HotM Server - Standalone HTTP API Server
//! 
//! This is the standalone HTTP server mode that provides the HotM API
//! for use by desktop clients or other applications.

use axum::{
    http::{header::CONTENT_TYPE, Method},
    routing::{delete, get, post, put},
    Router,
};
use hotm_core::{
    AppConfig,
    websocket::broadcaster::create_broadcaster,
    database::db::{DatabasePool, PostgresNoteRepository},
    ollama::client::{OllamaClient, AIService},
    job_queue::queue::PostgresJobQueue,
};
use std::{env, sync::Arc};
use tower_http::cors::{Any, CorsLayer};
use tracing::{info, error};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod routes;
mod app_state;

use app_state::AppState;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "hotm_server=info,axum=info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Load environment variables
    dotenvy::dotenv().ok();

    // Load configuration
    let config = load_config();
    info!("Starting HotM Server on {}:{}", config.bind_address, config.bind_port);
    info!("Database: {}", config.database_url.replace(":password@", ":***@"));
    info!("Ollama: {}", config.ollama_base_url);

    // Initialize WebSocket broadcaster
    let (ws_broadcaster, _rx) = create_broadcaster();

    // Initialize database connection
    let database = DatabasePool::connect(&config.database_url)
        .await
        .map_err(|e| {
            error!("Failed to connect to database: {}", e);
            e
        })?;

    // Initialize Ollama client
    let ollama_client = OllamaClient::new(config.ollama_base_url.clone());

    // Test Ollama connection
    if let Err(e) = <OllamaClient as AIService>::health_check(&ollama_client).await {
        error!("Ollama health check failed: {}. Some features may not work correctly.", e);
    } else {
        info!("Ollama connection established");
    }

    // Create note repository
    let note_repository = Arc::new(PostgresNoteRepository::new(
        database.pool.clone(),
        config.embed_model.clone(),
        config.generation_model.clone(),
    ));

    // Create job queue
    let job_queue = Arc::new(PostgresJobQueue::new(
        database.pool.clone(),
        Some(ws_broadcaster.clone()),
    ));

    // For now, skip the job queue manager - it needs specific processors
    // This can be added later when we implement the job processors
    // let job_manager = Arc::new(JobQueueManager::new(job_queue.clone()));
    // let job_manager_clone = job_manager.clone();
    // tokio::spawn(async move {
    //     job_manager_clone.start().await;
    // });

    // Create application state
    let app_state = AppState::new(
        database,
        ollama_client,
        ws_broadcaster.clone(),
        config.embed_model,
        config.generation_model,
        note_repository,
        job_queue,
    );

    // Build the application router
    let app = create_app_router(app_state);

    // Start the server
    let listener = tokio::net::TcpListener::bind(format!("{}:{}", config.bind_address, config.bind_port))
        .await?;
    
    info!("Server listening on http://{}:{}", config.bind_address, config.bind_port);
    
    axum::serve(listener, app).await?;

    Ok(())
}

fn load_config() -> AppConfig {
    AppConfig {
        database_url: env::var("DATABASE_URL")
            .unwrap_or_else(|_| "postgres://hotm:hotm@localhost:5432/hotm_dev".to_string()),
        ollama_base_url: env::var("OLLAMA_URL")
            .unwrap_or_else(|_| "http://localhost:11434".to_string()),
        embed_model: env::var("OLLAMA_EMBEDDING_MODEL")
            .unwrap_or_else(|_| "nomic-embed-text".to_string()),
        generation_model: env::var("OLLAMA_GENERATION_MODEL")
            .unwrap_or_else(|_| "gpt-oss:20b".to_string()),
        bind_address: env::var("BIND_ADDRESS")
            .unwrap_or_else(|_| "127.0.0.1".to_string()),
        bind_port: env::var("BIND_PORT")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(53211),
    }
}

fn create_app_router(app_state: AppState) -> Router {
    Router::new()
        // Health check
        .route("/health", get(routes::health::health_check))
        
        // API v1 routes
        .route("/api/v1", get(routes::health::api_info))
        .route("/api/v1/health", get(routes::health::health_check))
        
        // Notes endpoints
        .route("/api/v1/notes", get(routes::notes::list_notes))
        .route("/api/v1/notes", post(routes::notes::create_note))
        .route("/api/v1/notes/:id", get(routes::notes::get_note))
        .route("/api/v1/notes/:id", delete(routes::notes::delete_note))
        .route("/api/v1/notes/:id/status", put(routes::notes::update_note_status))
        .route("/api/v1/notes/:id/revised", put(routes::notes::put_revised))
        .route("/api/v1/notes/:id/title", put(routes::notes::update_note_title))
        .route("/api/v1/notes/:id/original", put(routes::notes::update_original_content))
        .route("/api/v1/notes/:id/regenerate-ai", post(routes::notes::regenerate_ai))
        .route("/api/v1/notes/:id/labels", get(routes::notes::get_metadata_labels))
        .route("/api/v1/notes/:id/labels", post(routes::notes::add_metadata_label))
        .route("/api/v1/notes/:id/labels/:label_id", delete(routes::notes::remove_metadata_label))
        .route("/api/v1/labels", get(routes::notes::get_all_labels))
        .route("/api/v1/notes/:id/link", post(routes::notes::create_note_link))
        
        // Search endpoints
        .route("/api/v1/search", get(routes::search::search))
        .route("/api/v1/search/context", post(routes::search::generate_search_context))
        .route("/api/v1/semantic", post(routes::search::semantic))
        .route("/api/v1/notes/:id/related", get(routes::search::find_related_notes))
        
        // Taxonomy endpoints
        .route("/api/v1/tags", post(routes::taxonomy::create_tag))
        .route("/api/v1/notes/:id/tags", put(routes::taxonomy::put_note_tags))
        .route("/api/v1/collections", post(routes::taxonomy::create_collection))
        .route("/api/v1/notes/:id/collection", put(routes::taxonomy::put_note_collection))
        
        // Links endpoints
        .route("/api/v1/notes/:id/links", post(routes::links::post_link))
        
        // Provenance endpoints
        .route("/api/v1/notes/:id/provenance", get(routes::provenance::get_provenance))
        
        // Job queue endpoints
        .route("/api/v1/jobs", post(routes::jobs::queue_job))
        .route("/api/v1/jobs/queue", get(routes::jobs::get_queue_status))
        .route("/api/v1/jobs/:id", get(routes::jobs::get_job_status))
        .route("/api/v1/jobs/:id/cancel", post(routes::jobs::cancel_job))
        .route("/api/v1/notes/:id/jobs", get(routes::jobs::get_note_jobs))
        
        // WebSocket endpoint
        .route("/api/v1/ws", get(routes::websocket::websocket_handler))
        .route("/ws", get(routes::websocket::websocket_handler))
        
        .with_state(app_state)
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE])
                .allow_headers([CONTENT_TYPE]),
        )
}