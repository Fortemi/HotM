//! WebSocket broadcaster for real-time updates
//! 
//! This module provides WebSocket functionality that can be shared between
//! server and unified runtime modes. Migrated from server/src/websocket.rs

#[cfg(feature = "websocket")]
pub use broadcaster::*;

#[cfg(feature = "websocket")]
pub mod broadcaster {
    use chrono::{DateTime, Utc};
    use serde::{Deserialize, Serialize};
    use std::sync::Arc;
    use tokio::sync::broadcast;
    use uuid::Uuid;

    #[derive(Clone, Debug, Serialize, Deserialize)]
    #[serde(tag = "type")]
    pub enum WsMessage {
        JobQueued {
            job_id: Uuid,
            job_type: String,
            note_id: Option<Uuid>,
            priority: i32,
        },
        JobStarted {
            job_id: Uuid,
            job_type: String,
            note_id: Option<Uuid>,
            estimated_duration_ms: Option<i64>,
        },
        JobProgress {
            job_id: Uuid,
            note_id: Option<Uuid>,
            progress_percent: i32,
            message: Option<String>,
        },
        JobCompleted {
            job_id: Uuid,
            job_type: String,
            note_id: Option<Uuid>,
            duration_ms: i64,
        },
        JobFailed {
            job_id: Uuid,
            job_type: String,
            note_id: Option<Uuid>,
            error: String,
            retry_count: i32,
        },
        NoteUpdated {
            note_id: Uuid,
            title: String,
            tags: Vec<String>,
            has_ai_content: bool,
            has_links: bool,
        },
        QueueStatus {
            total_jobs: usize,
            running: usize,
            pending: usize,
            active_job: Option<ActiveJob>,
        },
    }

    #[derive(Clone, Debug, Serialize, Deserialize)]
    pub struct ActiveJob {
        pub job_id: Uuid,
        pub job_type: String,
        pub progress_percent: i32,
        pub message: Option<String>,
        pub started_at: DateTime<Utc>,
    }

    pub type WsBroadcaster = Arc<broadcast::Sender<WsMessage>>;

    /// Create a new WebSocket broadcaster
    pub fn create_broadcaster() -> (WsBroadcaster, broadcast::Receiver<WsMessage>) {
        let (tx, rx) = broadcast::channel(100);
        (Arc::new(tx), rx)
    }

    /// Event Bus trait for WebSocket/notification abstraction
    #[async_trait::async_trait]
    pub trait EventBus: Send + Sync {
        async fn broadcast_message(&self, message: WsMessage);
        async fn connection_count(&self) -> usize;
    }

    /// Default WebSocket event bus implementation
    pub struct WebSocketEventBus {
        broadcaster: WsBroadcaster,
    }

    impl WebSocketEventBus {
        pub fn new(broadcaster: WsBroadcaster) -> Self {
            Self { broadcaster }
        }
    }

    #[async_trait::async_trait]
    impl EventBus for WebSocketEventBus {
        async fn broadcast_message(&self, message: WsMessage) {
            // Ignore if no receivers
            let _ = self.broadcaster.send(message);
        }

        async fn connection_count(&self) -> usize {
            self.broadcaster.receiver_count()
        }
    }

    /// Helper function to broadcast messages
    pub fn broadcast_message(broadcaster: &WsBroadcaster, msg: WsMessage) {
        // Ignore if no receivers
        let _ = broadcaster.send(msg);
    }

    #[cfg(feature = "axum")]
    pub mod axum_handlers {
        use super::*;
        use axum::{
            extract::{
                ws::{WebSocket, WebSocketUpgrade},
                State,
            },
            response::Response,
        };

        /// WebSocket handler for Axum web framework
        pub async fn ws_handler<T>(ws: WebSocketUpgrade, State(broadcaster): State<WsBroadcaster>) -> Response {
            ws.on_upgrade(move |socket| handle_socket(socket, broadcaster))
        }

        async fn handle_socket(mut socket: WebSocket, broadcaster: WsBroadcaster) {
            // Get a receiver for broadcast messages
            let mut rx = broadcaster.subscribe();

            // Send initial queue status if available
            // This would be handled by the implementing service

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
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn test_create_broadcaster() {
            let (_broadcaster, receiver) = create_broadcaster();
            // The receiver itself counts as 1
            drop(receiver); // Close receiver to get 0 count
        }

        #[test]
        fn test_broadcast_message() {
            let (broadcaster, mut receiver) = create_broadcaster();
            
            let message = WsMessage::NoteUpdated {
                note_id: Uuid::new_v4(),
                title: "Test Note".to_string(),
                tags: vec!["test".to_string()],
                has_ai_content: false,
                has_links: false,
            };

            broadcast_message(&broadcaster, message.clone());
            
            // Check if message is received
            let received = receiver.try_recv();
            assert!(received.is_ok());
        }

        #[tokio::test]
        async fn test_websocket_event_bus() {
            let (broadcaster, receiver) = create_broadcaster();
            let event_bus = WebSocketEventBus::new(broadcaster);

            let message = WsMessage::JobStarted {
                job_id: Uuid::new_v4(),
                job_type: "test".to_string(),
                note_id: Some(Uuid::new_v4()),
                estimated_duration_ms: Some(1000),
            };

            event_bus.broadcast_message(message).await;
            let count = event_bus.connection_count().await;
            assert_eq!(count, 1); // One receiver exists
            
            drop(receiver); // Close receiver
        }

        #[test]
        fn test_ws_message_serialization() {
            let message = WsMessage::QueueStatus {
                total_jobs: 5,
                running: 1,
                pending: 4,
                active_job: Some(ActiveJob {
                    job_id: Uuid::new_v4(),
                    job_type: "ai_revision".to_string(),
                    progress_percent: 50,
                    message: Some("Processing...".to_string()),
                    started_at: Utc::now(),
                }),
            };

            let serialized = serde_json::to_string(&message).unwrap();
            assert!(serialized.contains("QueueStatus"));
            assert!(serialized.contains("total_jobs"));

            let deserialized: WsMessage = serde_json::from_str(&serialized).unwrap();
            match deserialized {
                WsMessage::QueueStatus { total_jobs, .. } => {
                    assert_eq!(total_jobs, 5);
                }
                _ => panic!("Unexpected message type"),
            }
        }
    }
}