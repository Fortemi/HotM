use axum::{
    extract::{ws::{WebSocket, WebSocketUpgrade}, State},
    response::Response,
};
use std::sync::Arc;
use tokio::sync::broadcast;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use crate::db::AppState;

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
        estimated_duration_ms: Option<i64>,
    },
    JobProgress {
        job_id: Uuid,
        progress_percent: i32,
        message: Option<String>,
    },
    JobCompleted {
        job_id: Uuid,
        duration_ms: i64,
    },
    JobFailed {
        job_id: Uuid,
        error: String,
        retry_count: i32,
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
    pub started_at: chrono::DateTime<chrono::Utc>,
}

pub type WsBroadcaster = Arc<broadcast::Sender<WsMessage>>;

pub fn create_broadcaster() -> (WsBroadcaster, broadcast::Receiver<WsMessage>) {
    let (tx, rx) = broadcast::channel(100);
    (Arc::new(tx), rx)
}

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
) -> Response {
    ws.on_upgrade(move |socket| handle_socket(socket, state))
}

async fn handle_socket(mut socket: WebSocket, state: AppState) {
    // Get a receiver for broadcast messages
    let mut rx = state.ws_broadcaster.subscribe();
    
    // Send initial queue status
    if let Ok(status) = get_queue_status(&state).await {
        let msg = serde_json::to_string(&status).unwrap_or_default();
        let _ = socket.send(axum::extract::ws::Message::Text(msg)).await;
    }
    
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
                            if let Ok(status) = get_queue_status(&state).await {
                                let msg = serde_json::to_string(&status).unwrap_or_default();
                                let _ = socket.send(axum::extract::ws::Message::Text(msg)).await;
                            }
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

async fn get_queue_status(state: &AppState) -> Result<WsMessage, Box<dyn std::error::Error + Send + Sync>> {
    // Get current queue statistics
    let stats = sqlx::query!(
        r#"
        SELECT 
            COUNT(*) FILTER (WHERE status = 'pending') as "pending!",
            COUNT(*) FILTER (WHERE status = 'running') as "running!",
            COUNT(*) as "total!"
        FROM job_queue
        WHERE status IN ('pending', 'running')
        "#
    )
    .fetch_one(&state.pool)
    .await?;
    
    // Get active job if any
    let active_job = sqlx::query!(
        r#"
        SELECT 
            id, 
            job_type::text as "job_type!",
            progress_percent,
            progress_message,
            started_at
        FROM job_queue
        WHERE status = 'running'
        ORDER BY started_at DESC
        LIMIT 1
        "#
    )
    .fetch_optional(&state.pool)
    .await?
    .map(|row| ActiveJob {
        job_id: row.id,
        job_type: row.job_type,
        progress_percent: row.progress_percent,
        message: row.progress_message,
        started_at: row.started_at.unwrap_or_else(chrono::Utc::now),
    });
    
    Ok(WsMessage::QueueStatus {
        total_jobs: stats.total as usize,
        running: stats.running as usize,
        pending: stats.pending as usize,
        active_job,
    })
}

// Helper function to broadcast messages
pub fn broadcast_message(broadcaster: &WsBroadcaster, msg: WsMessage) {
    // Ignore if no receivers
    let _ = broadcaster.send(msg);
}