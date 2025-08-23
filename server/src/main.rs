use axum::{Router};
use axum::routing::{get, post, put, delete};
use hotm_server::{db::AppState, routes, job_queue, websocket};
use std::net::SocketAddr;
use std::sync::Arc;
use tower_http::cors::{CorsLayer, Any};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Load env (.env) if present
    let _ = dotenvy::dotenv();
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "hotm_server=info,axum=info".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let database_url = std::env::var("DATABASE_URL")
        .expect("DATABASE_URL must be set (e.g., postgres://user:pass@host:5432/db)");

    // Create WebSocket broadcaster
    let (ws_broadcaster, _rx) = websocket::create_broadcaster();
    
    let state = AppState::connect(&database_url, ws_broadcaster).await?;
    let state_arc = Arc::new(state.clone());
    
    // Start the job queue processor
    let job_manager = Arc::new(job_queue::JobQueueManager::new(state.pool.clone(), state_arc.clone()));
    let job_manager_clone = job_manager.clone();
    tokio::spawn(async move {
        job_manager_clone.start().await;
    });

    // Configure CORS to allow requests from Tauri app
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/api/v1", get(routes::health::api_info))
        .route("/api/v1/health", get(routes::health::health))
        .route("/api/v1/notes", get(routes::notes::list_notes))
        .route("/api/v1/notes", post(routes::notes::create_note))
        .route("/api/v1/notes/:id", get(routes::notes::get_note))
        .route("/api/v1/notes/:id", delete(routes::notes::delete_note))
        .route("/api/v1/notes/:id/status", put(routes::notes::update_note_status))
        .route("/api/v1/notes/:id/revised", put(routes::notes::put_revised))
        .route("/api/v1/notes/:id/regenerate-ai", post(routes::notes::regenerate_ai))
        .route("/api/v1/notes/:id/labels", get(routes::notes::get_metadata_labels))
        .route("/api/v1/notes/:id/labels", post(routes::notes::add_metadata_label))
        .route("/api/v1/notes/:id/labels/:label_id", delete(routes::notes::remove_metadata_label))
        .route("/api/v1/labels", get(routes::notes::get_all_labels))
        .route("/api/v1/notes/:id/link", post(routes::notes::create_note_link))
        .route("/api/v1/search", get(routes::search::search))
        .route("/api/v1/search/context", post(routes::search::generate_search_context))
        .route("/api/v1/semantic", post(routes::search::semantic))
        .route("/api/v1/notes/:id/related", get(routes::search::find_related_notes))
        .route("/api/v1/tags", post(routes::taxonomy::create_tag))
        .route("/api/v1/notes/:id/tags", put(routes::taxonomy::put_note_tags))
        .route("/api/v1/collections", post(routes::taxonomy::create_collection))
        .route("/api/v1/notes/:id/collection", put(routes::taxonomy::put_note_collection))
        .route("/api/v1/notes/:id/links", post(routes::links::post_link))
        .route("/api/v1/notes/:id/provenance", get(routes::provenance::get_provenance))
        .route("/api/v1/debug/revisions", get(routes::debug::debug_revisions))
        .route("/api/v1/jobs", post(routes::jobs::queue_job))
        .route("/api/v1/jobs/queue", get(routes::jobs::get_queue_status))
        .route("/api/v1/jobs/:id", get(routes::jobs::get_job_status))
        .route("/api/v1/jobs/:id/cancel", post(routes::jobs::cancel_job))
        .route("/api/v1/notes/:id/jobs", get(routes::jobs::get_note_jobs))
        .route("/api/v1/ws", get(websocket::ws_handler))
        .with_state(state)
        .layer(cors);

    let addr: SocketAddr = "0.0.0.0:53211".parse().unwrap();
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    tracing::info!(%addr, "HotM server listening");
    axum::serve(listener, app).await?;

    Ok(())
}
