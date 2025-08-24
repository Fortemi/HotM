//! WebSocket client for real-time updates from HotM server

use serde_json::Value;
use std::env;
use tokio_tungstenite::{connect_async, tungstenite::Message};
use futures_util::StreamExt;
use tauri::{AppHandle, Emitter};

/// WebSocket client for connecting to HotM server
pub struct WebSocketClient {
    app_handle: AppHandle,
}

impl WebSocketClient {
    pub fn new(app_handle: AppHandle) -> Self {
        Self { app_handle }
    }

    /// Start the WebSocket connection and listen for messages
    pub async fn start(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let api_url = env::var("HOTM_API_URL").unwrap_or_else(|_| "http://127.0.0.1:53211".to_string());
        let ws_url = api_url.replace("http://", "ws://").replace("https://", "wss://");
        let ws_url = format!("{}/ws", ws_url);

        println!("HotM Desktop: Connecting to WebSocket at {}", ws_url);

        match connect_async(&ws_url).await {
            Ok((ws_stream, _)) => {
                println!("HotM Desktop: WebSocket connected successfully");
                
                let (_write, mut read) = ws_stream.split();
                let app_handle = self.app_handle.clone();

                // Spawn task to handle incoming messages
                tokio::spawn(async move {
                    while let Some(msg) = read.next().await {
                        match msg {
                            Ok(Message::Text(text)) => {
                                println!("HotM Desktop: Received WebSocket message: {}", text);
                                
                                // Parse and emit the message to frontend
                                if let Ok(parsed) = serde_json::from_str::<Value>(&text) {
                                    if let Err(e) = app_handle.emit("websocket-message", parsed) {
                                        eprintln!("HotM Desktop: Failed to emit WebSocket message: {}", e);
                                    }
                                }
                            }
                            Ok(Message::Close(_)) => {
                                println!("HotM Desktop: WebSocket connection closed by server");
                                break;
                            }
                            Err(e) => {
                                eprintln!("HotM Desktop: WebSocket error: {}", e);
                                break;
                            }
                            _ => {} // Ignore other message types
                        }
                    }
                    
                    println!("HotM Desktop: WebSocket listener task finished");
                });

                Ok(())
            }
            Err(e) => {
                eprintln!("HotM Desktop: Failed to connect to WebSocket: {}", e);
                Err(Box::new(e))
            }
        }
    }
}

/// Tauri command to start WebSocket connection
#[tauri::command]
pub async fn start_websocket(app: AppHandle) -> Result<(), String> {
    let client = WebSocketClient::new(app);
    client.start().await.map_err(|e| e.to_string())
}