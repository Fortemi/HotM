//! Local HTTP server functionality for embedded mode
//! 
//! This module provides the ability to run a local HotM server
//! embedded within the desktop application.

use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;
use tauri::AppHandle;
use tokio::sync::RwLock;
use hotm_core::{AppConfig, EnvConfigLoader, ConfigLoader};
use sqlx::PgPool;

/// Local server state
pub struct LocalServer {
    addr: SocketAddr,
    shutdown_signal: Arc<RwLock<Option<tokio::sync::oneshot::Sender<()>>>>,
}

impl LocalServer {
    pub fn new(addr: SocketAddr) -> Self {
        Self {
            addr,
            shutdown_signal: Arc::new(RwLock::new(None)),
        }
    }

    /// Start the local server
    pub async fn start(&self, config: AppConfig) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        println!("HotM Desktop: Starting local server on {}", self.addr);

        // Create database pool
        let pool = PgPool::connect(&config.database_url).await
            .map_err(|e| format!("Failed to create database pool: {}", e))?;

        // Run database migrations
        sqlx::migrate!("../server/migrations")
            .run(&pool)
            .await
            .map_err(|e| format!("Failed to run migrations: {}", e))?;

        // Create shutdown channel
        let (shutdown_tx, shutdown_rx) = tokio::sync::oneshot::channel();
        
        // Store shutdown sender
        {
            let mut signal = self.shutdown_signal.write().await;
            *signal = Some(shutdown_tx);
        }

        // For now, create a simple health endpoint
        // TODO: Integrate full hotm-server functionality
        use axum::{routing::get, Router};
        use axum::response::Json;
        
        let app = Router::new()
            .route("/health", get(|| async { 
                Json(serde_json::json!({"status": "ok", "service": "hotm-desktop-embedded"})) 
            }));

        // Start the server
        let listener = tokio::net::TcpListener::bind(self.addr).await
            .map_err(|e| format!("Failed to bind to address: {}", e))?;

        println!("HotM Desktop: Local server listening on {}", self.addr);

        // Spawn server task
        tokio::spawn(async move {
            axum::serve(listener, app)
                .with_graceful_shutdown(async {
                    shutdown_rx.await.ok();
                    println!("HotM Desktop: Server shutdown signal received");
                })
                .await
                .map_err(|e| eprintln!("HotM Desktop: Server error: {}", e))
                .ok();
        });

        Ok(())
    }

    /// Stop the local server
    pub async fn stop(&self) -> Result<(), String> {
        let mut signal = self.shutdown_signal.write().await;
        
        if let Some(sender) = signal.take() {
            sender.send(()).map_err(|_| "Failed to send shutdown signal".to_string())?;
            println!("HotM Desktop: Local server shutdown initiated");
            
            // Give the server time to shut down gracefully
            tokio::time::sleep(Duration::from_millis(500)).await;
            
            Ok(())
        } else {
            Err("Server is not running".to_string())
        }
    }

    /// Check if server is running
    pub async fn is_running(&self) -> bool {
        let signal = self.shutdown_signal.read().await;
        signal.is_some()
    }
}

/// Global server instance
static SERVER: tokio::sync::OnceCell<LocalServer> = tokio::sync::OnceCell::const_new();

/// Tauri command to start local server
#[tauri::command]
pub async fn start_local_server(_app: AppHandle, port: Option<u16>) -> Result<String, String> {
    let port = port.unwrap_or(53211);
    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    
    // Initialize server instance
    let server = SERVER.get_or_init(|| async {
        LocalServer::new(addr)
    }).await;

    // Check if already running
    if server.is_running().await {
        return Err("Local server is already running".to_string());
    }

    // Load configuration
    let loader = EnvConfigLoader::new();
    let config = loader.load_config(None)
        .map_err(|e| format!("Failed to load configuration: {}", e))?;

    // Start the server
    server.start(config).await
        .map_err(|e| format!("Failed to start local server: {}", e))?;

    Ok(format!("Local server started on {}", addr))
}

/// Tauri command to stop local server
#[tauri::command]
pub async fn stop_local_server(_app: AppHandle) -> Result<String, String> {
    if let Some(server) = SERVER.get() {
        server.stop().await?;
        Ok("Local server stopped".to_string())
    } else {
        Err("Local server is not running".to_string())
    }
}

/// Tauri command to get local server status
#[tauri::command]
pub async fn get_local_server_status(_app: AppHandle) -> Result<serde_json::Value, String> {
    let is_running = if let Some(server) = SERVER.get() {
        server.is_running().await
    } else {
        false
    };

    Ok(serde_json::json!({
        "running": is_running,
        "port": 53211,
        "url": "http://127.0.0.1:53211"
    }))
}