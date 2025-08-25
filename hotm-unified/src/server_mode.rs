//! Server mode implementation for unified runtime

#[cfg(feature = "server")]
use axum::{
    Router,
};
#[cfg(feature = "server")]
use hotm_core::{
    websocket::broadcaster::create_broadcaster,
    database::db::{DatabasePool, PostgresNoteRepository},
    ollama::client::{OllamaClient, AIService},
    job_queue::queue::PostgresJobQueue,
};
#[cfg(feature = "server")]
use std::sync::Arc;
#[cfg(feature = "server")]
// use tower_http::cors::{Any, CorsLayer};
#[cfg(feature = "server")]
use tracing::{info, error};

#[cfg(feature = "server")]
pub async fn run_server(config: crate::config::AppConfig) -> anyhow::Result<()> {
    info!("Initializing server components...");
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

#[cfg(feature = "server")]
#[derive(Clone)]
struct AppState {
    database: hotm_core::database::db::DatabasePool,
    ollama_client: hotm_core::ollama::client::OllamaClient,
    ws_broadcaster: hotm_core::websocket::broadcaster::WsBroadcaster,
    #[allow(dead_code)]
    embed_model: String,
    #[allow(dead_code)]
    generation_model: String,
    #[allow(dead_code)]
    note_repository: Arc<PostgresNoteRepository>,
    #[allow(dead_code)]
    job_queue: Arc<PostgresJobQueue>,
}

#[cfg(feature = "server")]
impl AppState {
    fn new(
        database: hotm_core::database::db::DatabasePool,
        ollama_client: hotm_core::ollama::client::OllamaClient,
        ws_broadcaster: hotm_core::websocket::broadcaster::WsBroadcaster,
        embed_model: String,
        generation_model: String,
        note_repository: Arc<PostgresNoteRepository>,
        job_queue: Arc<PostgresJobQueue>,
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

#[cfg(feature = "server")]
fn create_app_router(app_state: AppState) -> Router {
    use axum::routing::{get, post};
    use tower_http::cors::CorsLayer;
    // use axum::http::{header::CONTENT_TYPE, Method};

    // Import route modules
    mod routes {
        pub mod health {
            use super::super::AppState;
            use axum::extract::State;
            use serde_json::json;
            use hotm_core::ollama::client::AIService;
            
            pub async fn health_check(State(app_state): State<AppState>) -> axum::Json<serde_json::Value> {
                // Check database health
                let db_healthy = app_state.database.health_check().await.is_ok();
                
                // Check Ollama health
                let ollama_healthy = <hotm_core::ollama::client::OllamaClient as AIService>::health_check(&app_state.ollama_client).await.is_ok();
                
                let status = if db_healthy && ollama_healthy { "healthy" } else { "degraded" };
                
                axum::Json(json!({
                    "status": status,
                    "version": env!("CARGO_PKG_VERSION"),
                    "mode": "unified-server",
                    "services": {
                        "database": if db_healthy { "healthy" } else { "unhealthy" },
                        "ollama": if ollama_healthy { "healthy" } else { "unhealthy" }
                    },
                    "websocket_connections": app_state.ws_broadcaster.receiver_count()
                }))
            }
            
            pub async fn api_info() -> axum::Json<serde_json::Value> {
                axum::Json(json!({
                    "name": "HotM API",
                    "version": "v1",
                    "description": "Hall of Mind notes and analysis API",
                    "endpoints": [
                        "/api/v1/health",
                        "/api/v1/notes",
                        "/api/v1/search",
                        "/api/v1/ws"
                    ]
                }))
            }
        }
        
        pub mod websocket {
            use super::super::AppState;
            use axum::extract::{State, WebSocketUpgrade};
            use axum::response::Response;
            
            pub async fn websocket_handler(
                ws: WebSocketUpgrade,
                State(app_state): State<AppState>,
            ) -> Response {
                ws.on_upgrade(move |socket| handle_socket(socket, app_state.ws_broadcaster))
            }
            
            async fn handle_socket(mut socket: axum::extract::ws::WebSocket, broadcaster: hotm_core::websocket::broadcaster::WsBroadcaster) {
                use futures::stream::StreamExt;
                
                // Get a receiver for broadcast messages
                let mut rx = broadcaster.subscribe();
            
                // Start listening for messages to broadcast
                loop {
                    tokio::select! {
                        // Receive broadcast messages and forward to client
                        Ok(msg) = rx.recv() => {
                            let json = serde_json::to_string(&msg).unwrap_or_default();
                            if socket.send(axum::extract::ws::Message::Text(json)).await.is_err() {
                                break;
                            }
                        }
                        // Handle client messages (though we don't expect any)
                        Some(Ok(msg)) = socket.next() => {
                            match msg {
                                axum::extract::ws::Message::Close(_) => break,
                                _ => {} // Ignore other message types
                            }
                        }
                        else => break
                    }
                }
            }
        }
        
        pub mod placeholder {
            use super::super::AppState;
            use axum::extract::{Path, Query, State};
            use axum::Json;
            use serde_json::json;
            use std::collections::HashMap;
            
            pub async fn create_note_placeholder(
                State(_app_state): State<AppState>,
                Json(_note): Json<hotm_core::CreateNoteRequest>,
            ) -> Json<serde_json::Value> {
                Json(json!({
                    "error": "Not implemented yet",
                    "message": "Full route implementation coming from hotm-server integration"
                }))
            }
            
            pub async fn get_note_placeholder(
                State(_app_state): State<AppState>,
                Path(_note_id): Path<uuid::Uuid>,
            ) -> Json<serde_json::Value> {
                Json(json!({
                    "error": "Not implemented yet",
                    "message": "Full route implementation coming from hotm-server integration"
                }))
            }
            
            pub async fn search_notes_placeholder(
                State(_app_state): State<AppState>,
                Query(_query): Query<HashMap<String, String>>,
            ) -> Json<serde_json::Value> {
                Json(json!({
                    "error": "Not implemented yet", 
                    "message": "Full route implementation coming from hotm-server integration"
                }))
            }
        }
    }

    Router::new()
        // Health check
        .route("/health", get(routes::health::health_check))
        
        // API v1 routes
        .route("/api/v1", get(routes::health::api_info))
        .route("/api/v1/health", get(routes::health::health_check))
        
        // Placeholder implementations (will be replaced with full hotm-server routes)
        .route("/api/v1/notes", get(routes::placeholder::search_notes_placeholder))
        .route("/api/v1/notes", post(routes::placeholder::create_note_placeholder))
        .route("/api/v1/notes/:id", get(routes::placeholder::get_note_placeholder))
        .route("/api/v1/search", get(routes::placeholder::search_notes_placeholder))
        
        // WebSocket endpoints
        .route("/api/v1/ws", get(routes::websocket::websocket_handler))
        .route("/ws", get(routes::websocket::websocket_handler))
        
        .with_state(app_state)
        .layer(
            CorsLayer::permissive()
        )
}