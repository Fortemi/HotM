//! Job queue abstractions for background processing
//! 
//! This module provides job queue functionality that can be shared between
//! server and unified runtime modes. Migrated from server/src/job_queue.rs

#[cfg(feature = "database")]
pub mod queue {
    use anyhow::Result;
    use chrono::{DateTime, Utc};
    use serde::{Deserialize, Serialize};
    use sqlx::PgPool;
    use std::sync::Arc;
    use tokio::sync::{Mutex, Notify};
    use tokio::time::{sleep, Duration};
    use tracing::{error, info, warn};
    use uuid::Uuid;

    #[cfg(feature = "websocket")]
    use crate::websocket::{broadcast_message, WsBroadcaster, WsMessage};

    #[derive(Debug, Clone, PartialEq, Serialize, Deserialize, sqlx::Type)]
    #[sqlx(type_name = "job_status", rename_all = "lowercase")]
    pub enum JobStatus {
        Pending,
        Running,
        Completed,
        Failed,
        Cancelled,
    }

    #[derive(Debug, Clone, PartialEq, Serialize, Deserialize, sqlx::Type)]
    #[sqlx(type_name = "job_type", rename_all = "snake_case")]
    pub enum JobType {
        AiRevision,
        Embedding,
        Linking,
        ContextUpdate,
        TitleGeneration,
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct Job {
        pub id: Uuid,
        pub note_id: Option<Uuid>,
        pub job_type: JobType,
        pub status: JobStatus,
        pub priority: i32,
        pub payload: Option<serde_json::Value>,
        pub result: Option<serde_json::Value>,
        pub error_message: Option<String>,
        pub estimated_duration_ms: Option<i32>,
        pub actual_duration_ms: Option<i32>,
        pub progress_percent: i32,
        pub created_at: DateTime<Utc>,
        pub started_at: Option<DateTime<Utc>>,
        pub completed_at: Option<DateTime<Utc>>,
        pub retry_count: i32,
        pub max_retries: i32,
    }

    #[derive(Debug, Clone, Serialize)]
    pub struct JobProgress {
        pub job_id: Uuid,
        pub status: JobStatus,
        pub progress_percent: i32,
        pub message: Option<String>,
    }

    /// Job Queue trait for testability and abstraction
    #[async_trait::async_trait]
    pub trait JobQueue: Send + Sync {
        async fn queue_job(&self, note_id: Option<Uuid>, job_type: JobType, priority: i32, payload: Option<serde_json::Value>) -> Result<Uuid>;
        async fn get_next_job(&self) -> Result<Option<Job>>;
        async fn update_job_progress(&self, job_id: Uuid, progress: i32, message: Option<&str>) -> Result<()>;
        async fn complete_job(&self, job_id: Uuid, result: Option<serde_json::Value>) -> Result<()>;
        async fn fail_job(&self, job_id: Uuid, error: &str) -> Result<()>;
        async fn cancel_job(&self, job_id: Uuid) -> Result<()>;
        async fn get_queue_status(&self) -> Result<Vec<serde_json::Value>>;
    }

    /// Job processor trait for different job types
    #[async_trait::async_trait]
    pub trait JobProcessor: Send + Sync {
        async fn process_job(&self, job: &Job) -> Result<serde_json::Value>;
        fn can_process(&self, job_type: &JobType) -> bool;
    }

    /// PostgreSQL-based job queue implementation
    pub struct PostgresJobQueue {
        pool: PgPool,
        #[cfg(feature = "websocket")]
        ws_broadcaster: Option<WsBroadcaster>,
    }

    impl PostgresJobQueue {
        #[cfg(feature = "websocket")]
        pub fn new(pool: PgPool, ws_broadcaster: Option<WsBroadcaster>) -> Self {
            Self { pool, ws_broadcaster }
        }
        
        #[cfg(not(feature = "websocket"))]
        pub fn new(pool: PgPool) -> Self {
            Self { pool }
        }
    }

    #[async_trait::async_trait]
    impl JobQueue for PostgresJobQueue {
        async fn queue_job(&self, note_id: Option<Uuid>, job_type: JobType, priority: i32, payload: Option<serde_json::Value>) -> Result<Uuid> {
            // Estimate duration based on history
            let estimated_duration = sqlx::query_scalar!(
                "SELECT estimate_job_duration($1::job_type, NULL)",
                &job_type as &JobType
            )
            .fetch_one(&self.pool)
            .await?;

            let job_id = Uuid::new_v4();

            sqlx::query!(
                r#"
                INSERT INTO job_queue (id, note_id, job_type, priority, payload, estimated_duration_ms)
                VALUES ($1, $2, $3, $4, $5, $6)
                "#,
                job_id,
                note_id,
                &job_type as &JobType,
                priority,
                payload,
                estimated_duration
            )
            .execute(&self.pool)
            .await?;

            info!("Queued job {} of type {:?}", job_id, job_type);

            // Broadcast job queued event
            #[cfg(feature = "websocket")]
            if let Some(broadcaster) = &self.ws_broadcaster {
                broadcast_message(
                    broadcaster,
                    WsMessage::JobQueued {
                        job_id,
                        job_type: format!("{:?}", job_type),
                        note_id,
                        priority,
                    },
                );
            }

            Ok(job_id)
        }

        async fn get_next_job(&self) -> Result<Option<Job>> {
            // Atomic update to claim a job
            let job = sqlx::query_as!(
                Job,
                r#"
                UPDATE job_queue
                SET status = 'running'::job_status,
                    started_at = NOW()
                WHERE id = (
                    SELECT id FROM job_queue
                    WHERE status = 'pending'::job_status
                    ORDER BY priority DESC, created_at ASC
                    FOR UPDATE SKIP LOCKED
                    LIMIT 1
                )
                RETURNING 
                    id, note_id, 
                    job_type as "job_type: JobType",
                    status as "status: JobStatus",
                    priority, payload, result, error_message,
                    estimated_duration_ms, actual_duration_ms, progress_percent,
                    created_at, started_at, completed_at,
                    retry_count, max_retries
                "#
            )
            .fetch_optional(&self.pool)
            .await?;

            Ok(job)
        }

        async fn update_job_progress(&self, job_id: Uuid, progress: i32, message: Option<&str>) -> Result<()> {
            sqlx::query!(
                r#"
                UPDATE job_queue
                SET progress_percent = $1, progress_message = $2
                WHERE id = $3
                "#,
                progress,
                message,
                job_id
            )
            .execute(&self.pool)
            .await?;

            // Broadcast progress update via WebSocket
            #[cfg(feature = "websocket")]
            if let Some(broadcaster) = &self.ws_broadcaster {
                // Get note_id for this job
                let note_id = sqlx::query_scalar!("SELECT note_id FROM job_queue WHERE id = $1", job_id)
                    .fetch_optional(&self.pool)
                    .await?
                    .flatten();
                
                broadcast_message(
                    broadcaster,
                    WsMessage::JobProgress {
                        job_id,
                        note_id,
                        progress_percent: progress,
                        message: message.map(String::from),
                    },
                );
            }

            info!("Job {} progress: {}% - {:?}", job_id, progress, message);
            Ok(())
        }

        async fn complete_job(&self, job_id: Uuid, result: Option<serde_json::Value>) -> Result<()> {
            let _duration_ms = sqlx::query_scalar!(
                r#"
                UPDATE job_queue
                SET status = 'completed'::job_status,
                    completed_at = NOW(),
                    result = $1,
                    progress_percent = 100,
                    actual_duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000
                WHERE id = $2
                RETURNING actual_duration_ms
                "#,
                result,
                job_id
            )
            .fetch_one(&self.pool)
            .await?;

            // Get job info for broadcasting
            #[cfg(feature = "websocket")]
            {
                let job_info = sqlx::query!(
                    "SELECT job_type::text as job_type, note_id FROM job_queue WHERE id = $1",
                    job_id
                )
                .fetch_one(&self.pool)
                .await?;

                if let Some(broadcaster) = &self.ws_broadcaster {
                    broadcast_message(
                        broadcaster,
                        WsMessage::JobCompleted {
                            job_id,
                            job_type: job_info.job_type.unwrap_or_default(),
                            note_id: job_info.note_id,
                            duration_ms: _duration_ms.unwrap_or(0) as i64,
                        },
                    );
                }
            }

            info!("Job {} completed successfully", job_id);
            Ok(())
        }

        async fn fail_job(&self, job_id: Uuid, error: &str) -> Result<()> {
            #[cfg(feature = "websocket")]
            {
                let job_info = sqlx::query!(
                    r#"
                    UPDATE job_queue
                    SET status = 'failed'::job_status,
                        completed_at = NOW(),
                        error_message = $1,
                        actual_duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000
                    WHERE id = $2
                    RETURNING job_type::text as job_type, note_id, retry_count
                    "#,
                    error,
                    job_id
                )
                .fetch_one(&self.pool)
                .await?;

                if let Some(broadcaster) = &self.ws_broadcaster {
                    broadcast_message(
                        broadcaster,
                        WsMessage::JobFailed {
                            job_id,
                            job_type: job_info.job_type.unwrap_or_default(),
                            note_id: job_info.note_id,
                            error: error.to_string(),
                            retry_count: job_info.retry_count,
                        },
                    );
                }
            }
            
            #[cfg(not(feature = "websocket"))]
            {
                sqlx::query!(
                    r#"
                    UPDATE job_queue
                    SET status = 'failed'::job_status,
                        completed_at = NOW(),
                        error_message = $1,
                        actual_duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000
                    WHERE id = $2
                    "#,
                    error,
                    job_id
                )
                .execute(&self.pool)
                .await?;
            }

            warn!("Job {} failed: {}", job_id, error);
            Ok(())
        }

        async fn cancel_job(&self, job_id: Uuid) -> Result<()> {
            sqlx::query!(
                r#"
                UPDATE job_queue
                SET status = 'cancelled'::job_status,
                    completed_at = NOW()
                WHERE id = $1 AND status = 'pending'::job_status
                "#,
                job_id
            )
            .execute(&self.pool)
            .await?;

            info!("Job {} cancelled", job_id);
            Ok(())
        }

        async fn get_queue_status(&self) -> Result<Vec<serde_json::Value>> {
            let status = sqlx::query!(
                r#"
                SELECT 
                    id,
                    note_id,
                    job_type as "job_type: JobType",
                    status as "status: JobStatus",
                    progress_percent,
                    estimated_duration_ms,
                    remaining_ms,
                    queue_wait_ms,
                    note_title
                FROM job_queue_status
                "#
            )
            .fetch_all(&self.pool)
            .await?;

            let result: Vec<serde_json::Value> = status
                .into_iter()
                .map(|row| {
                    serde_json::json!({
                        "id": row.id,
                        "note_id": row.note_id,
                        "job_type": row.job_type,
                        "status": row.status,
                        "progress_percent": row.progress_percent,
                        "estimated_duration_ms": row.estimated_duration_ms,
                        "remaining_ms": row.remaining_ms,
                        "queue_wait_ms": row.queue_wait_ms,
                        "note_title": row.note_title
                    })
                })
                .collect();

            Ok(result)
        }
    }

    /// Job queue manager - ensures single GPU usage
    pub struct JobQueueManager<Q: JobQueue, P: JobProcessor> {
        queue: Arc<Q>,
        processors: Vec<Arc<P>>,
        is_processing: Arc<Mutex<bool>>,
        notify: Arc<Notify>,
    }

    impl<Q: JobQueue + 'static, P: JobProcessor + 'static> JobQueueManager<Q, P> {
        pub fn new(queue: Arc<Q>) -> Self {
            Self {
                queue,
                processors: Vec::new(),
                is_processing: Arc::new(Mutex::new(false)),
                notify: Arc::new(Notify::new()),
            }
        }

        pub fn add_processor(&mut self, processor: Arc<P>) {
            self.processors.push(processor);
        }

        /// Start the job queue processor
        pub async fn start(self: Arc<Self>) {
            info!("Starting job queue processor");

            // Start the main processing loop
            let processor = self.clone();
            tokio::spawn(async move {
                processor.processing_loop().await;
            });
        }

        /// Main processing loop
        async fn processing_loop(&self) {
            loop {
                // Check if we're already processing
                let mut is_processing = self.is_processing.lock().await;
                if *is_processing {
                    drop(is_processing);
                    // Wait for notification or timeout
                    tokio::select! {
                        _ = self.notify.notified() => {},
                        _ = sleep(Duration::from_secs(5)) => {}
                    }
                    continue;
                }

                // Try to get the next job
                match self.queue.get_next_job().await {
                    Ok(Some(job)) => {
                        *is_processing = true;
                        drop(is_processing);

                        info!("Processing job: {:?}", job.id);

                        // Process the job
                        if let Err(e) = self.process_job(job).await {
                            error!("Failed to process job: {}", e);
                        }

                        // Mark as not processing
                        *self.is_processing.lock().await = false;

                        // Notify that we're done
                        self.notify.notify_one();
                    }
                    Ok(None) => {
                        // No jobs available
                        drop(is_processing);
                        sleep(Duration::from_secs(2)).await;
                    }
                    Err(e) => {
                        error!("Failed to get next job: {}", e);
                        drop(is_processing);
                        sleep(Duration::from_secs(5)).await;
                    }
                }
            }
        }

        /// Process a single job
        async fn process_job(&self, job: Job) -> Result<()> {
            // Update progress
            self.queue
                .update_job_progress(job.id, 0, Some("Starting job"))
                .await?;

            // Find a processor for this job type
            let processor = self
                .processors
                .iter()
                .find(|p| p.can_process(&job.job_type))
                .ok_or_else(|| anyhow::anyhow!("No processor found for job type {:?}", job.job_type))?;

            // Process the job
            match processor.process_job(&job).await {
                Ok(result_data) => {
                    self.queue.complete_job(job.id, Some(result_data)).await?;
                    info!("Job {} completed successfully", job.id);
                }
                Err(e) => {
                    let error_msg = format!("{}", e);
                    warn!("Job {} failed: {}", job.id, error_msg);

                    // Check if we should retry
                    if job.retry_count < job.max_retries {
                        // Will be retried by setting it back to pending
                        // This would be handled by the specific queue implementation
                        info!("Job {} will be retried", job.id);
                    } else {
                        self.queue.fail_job(job.id, &error_msg).await?;
                    }
                }
            }

            Ok(())
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn test_job_status_serialization() {
            let status = JobStatus::Running;
            let serialized = serde_json::to_string(&status).unwrap();
            assert_eq!(serialized, "\"Running\"");
        }

        #[test]
        fn test_job_type_serialization() {
            let job_type = JobType::AiRevision;
            let serialized = serde_json::to_string(&job_type).unwrap();
            assert_eq!(serialized, "\"AiRevision\"");
        }

        #[test]
        fn test_job_creation() {
            let job = Job {
                id: Uuid::new_v4(),
                note_id: Some(Uuid::new_v4()),
                job_type: JobType::Embedding,
                status: JobStatus::Pending,
                priority: 5,
                payload: None,
                result: None,
                error_message: None,
                estimated_duration_ms: Some(1000),
                actual_duration_ms: None,
                progress_percent: 0,
                created_at: Utc::now(),
                started_at: None,
                completed_at: None,
                retry_count: 0,
                max_retries: 3,
            };

            assert_eq!(job.status, JobStatus::Pending);
            assert_eq!(job.job_type, JobType::Embedding);
            assert_eq!(job.progress_percent, 0);
            assert_eq!(job.priority, 5);
        }
    }
}