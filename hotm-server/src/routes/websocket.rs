//! WebSocket endpoint for real-time updates

use axum::{
    extract::{
        ws::{WebSocket, WebSocketUpgrade},
        State,
    },
    response::Response,
};
use hotm_core::websocket::broadcaster::WsBroadcaster;

use crate::app_state::AppState;

pub async fn websocket_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
) -> Response {
    ws.on_upgrade(move |socket| websocket_connection(socket, state.ws_broadcaster))
}

async fn websocket_connection(mut socket: WebSocket, broadcaster: WsBroadcaster) {
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
            // Handle incoming messages from client (if any)
            Some(msg) = socket.recv() => {
                match msg {
                    Ok(axum::extract::ws::Message::Text(text)) => {
                        // Handle client messages if needed (e.g., request refresh)
                        if text == "refresh" {
                            // Implementation would depend on the specific service
                            // For now, just continue the loop
                        }
                    }
                    Ok(axum::extract::ws::Message::Close(_)) | Err(_) => {
                        break;
                    }
                    _ => {}
                }
            }
            else => break,
        }
    }
}