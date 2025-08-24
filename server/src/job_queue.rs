use crate::db::AppState;
use crate::websocket::{broadcast_message, WsMessage};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::sync::Arc;
use tokio::sync::{Mutex, Notify};
use tokio::time::{sleep, Duration};
use tracing::{error, info, warn};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "job_status", rename_all = "lowercase")]
pub enum JobStatus {
    Pending,
    Running,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
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

/// Job queue manager - ensures single GPU usage
pub struct JobQueueManager {
    pool: PgPool,
    state: Arc<AppState>,
    is_processing: Arc<Mutex<bool>>,
    notify: Arc<Notify>,
}

impl JobQueueManager {
    pub fn new(pool: PgPool, state: Arc<AppState>) -> Self {
        Self {
            pool,
            state,
            is_processing: Arc::new(Mutex::new(false)),
            notify: Arc::new(Notify::new()),
        }
    }

    /// Start the job queue processor
    pub async fn start(self: Arc<Self>) {
        info!("Starting job queue processor");

        // Start the main processing loop
        let processor = self.clone();
        tokio::spawn(async move {
            processor.processing_loop().await;
        });

        // Start the progress broadcaster
        let broadcaster = self.clone();
        tokio::spawn(async move {
            broadcaster.broadcast_progress_loop().await;
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
            match self.get_next_job().await {
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

    /// Get the next job from the queue
    async fn get_next_job(&self) -> anyhow::Result<Option<Job>> {
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

    /// Process a single job
    async fn process_job(&self, job: Job) -> anyhow::Result<()> {
        let start_time = std::time::Instant::now();

        // Broadcast job started
        broadcast_message(
            &self.state.ws_broadcaster,
            WsMessage::JobStarted {
                job_id: job.id,
                job_type: format!("{:?}", job.job_type),
                note_id: job.note_id,
                estimated_duration_ms: job.estimated_duration_ms.map(|d| d as i64),
            },
        );

        // Broadcast updated queue status
        if let Err(e) = self.broadcast_queue_status().await {
            tracing::warn!("Failed to broadcast queue status: {}", e);
        }

        // Update progress
        self.update_progress(&job.id, 0, Some("Starting job"))
            .await?;

        let result = match job.job_type {
            JobType::AiRevision => self.process_ai_revision(&job).await,
            JobType::Embedding => self.process_embedding(&job).await,
            JobType::Linking => self.process_linking(&job).await,
            JobType::ContextUpdate => self.process_context_update(&job).await,
            JobType::TitleGeneration => self.process_title_generation(&job).await,
        };

        let duration_ms = start_time.elapsed().as_millis() as i32;

        match result {
            Ok(result_data) => {
                // Mark job as completed
                sqlx::query!(
                    r#"
                    UPDATE job_queue
                    SET status = 'completed'::job_status,
                        completed_at = NOW(),
                        actual_duration_ms = $1,
                        result = $2,
                        progress_percent = 100
                    WHERE id = $3
                    "#,
                    duration_ms,
                    result_data,
                    job.id
                )
                .execute(&self.pool)
                .await?;

                // Record in history for estimation
                self.record_job_history(&job.job_type, duration_ms, true)
                    .await?;

                // Broadcast job completed
                broadcast_message(
                    &self.state.ws_broadcaster,
                    WsMessage::JobCompleted {
                        job_id: job.id,
                        job_type: format!("{:?}", job.job_type),
                        note_id: job.note_id,
                        duration_ms: duration_ms as i64,
                    },
                );

                // Broadcast note updated if there's a note_id
                if let Some(note_id) = job.note_id {
                    if let Err(e) = self.broadcast_note_update(note_id).await {
                        tracing::warn!("Failed to broadcast note update: {}", e);
                    }
                }

                // Broadcast updated queue status
                if let Err(e) = self.broadcast_queue_status().await {
                    tracing::warn!("Failed to broadcast queue status: {}", e);
                }

                info!("Job {} completed in {}ms", job.id, duration_ms);
            }
            Err(e) => {
                let error_msg = format!("{}", e);
                warn!("Job {} failed: {}", job.id, error_msg);

                // Broadcast job failed
                broadcast_message(
                    &self.state.ws_broadcaster,
                    WsMessage::JobFailed {
                        job_id: job.id,
                        job_type: format!("{:?}", job.job_type),
                        note_id: job.note_id,
                        error: error_msg.clone(),
                        retry_count: job.retry_count,
                    },
                );

                // Check if we should retry
                if job.retry_count < job.max_retries {
                    sqlx::query!(
                        r#"
                        UPDATE job_queue
                        SET status = 'pending'::job_status,
                            retry_count = retry_count + 1,
                            error_message = $1,
                            started_at = NULL,
                            progress_percent = 0
                        WHERE id = $2
                        "#,
                        error_msg,
                        job.id
                    )
                    .execute(&self.pool)
                    .await?;
                } else {
                    // Mark as failed
                    sqlx::query!(
                        r#"
                        UPDATE job_queue
                        SET status = 'failed'::job_status,
                            completed_at = NOW(),
                            actual_duration_ms = $1,
                            error_message = $2
                        WHERE id = $3
                        "#,
                        duration_ms,
                        error_msg,
                        job.id
                    )
                    .execute(&self.pool)
                    .await?;
                }

                self.record_job_history(&job.job_type, duration_ms, false)
                    .await?;

                // Broadcast updated queue status after failure
                if let Err(e) = self.broadcast_queue_status().await {
                    tracing::warn!("Failed to broadcast queue status: {}", e);
                }
            }
        }

        Ok(())
    }

    /// Process AI revision job
    async fn process_ai_revision(&self, job: &Job) -> anyhow::Result<serde_json::Value> {
        let note_id = job
            .note_id
            .ok_or_else(|| anyhow::anyhow!("No note_id for AI revision job"))?;

        self.update_progress(&job.id, 10, Some("Fetching note content"))
            .await?;

        // Get note content
        let note = sqlx::query!(
            "SELECT content FROM note_original WHERE note_id = $1",
            note_id
        )
        .fetch_one(&self.pool)
        .await?;

        self.update_progress(&job.id, 20, Some("Generating AI revision"))
            .await?;

        // Call the AI revision function
        crate::db_enhanced_v2::generate_ai_revision_with_metadata(
            &self.state,
            note_id,
            &note.content,
        )
        .await?;

        self.update_progress(&job.id, 100, Some("Completed"))
            .await?;

        Ok(serde_json::json!({
            "note_id": note_id,
            "success": true
        }))
    }

    /// Process embedding job
    async fn process_embedding(&self, job: &Job) -> anyhow::Result<serde_json::Value> {
        let note_id = job
            .note_id
            .ok_or_else(|| anyhow::anyhow!("No note_id for embedding job"))?;

        self.update_progress(&job.id, 10, Some("Fetching content"))
            .await?;

        // Get revised content
        let content = sqlx::query!(
            "SELECT content FROM note_revised_current WHERE note_id = $1",
            note_id
        )
        .fetch_one(&self.pool)
        .await?;

        self.update_progress(&job.id, 30, Some("Generating embeddings"))
            .await?;

        // Generate embeddings
        crate::db_enhanced_v2::embed_note_content(&self.state, note_id, &content.content).await?;

        self.update_progress(&job.id, 100, Some("Completed"))
            .await?;

        Ok(serde_json::json!({
            "note_id": note_id,
            "success": true
        }))
    }

    /// Process linking job
    async fn process_linking(&self, job: &Job) -> anyhow::Result<serde_json::Value> {
        let note_id = job
            .note_id
            .ok_or_else(|| anyhow::anyhow!("No note_id for linking job"))?;

        self.update_progress(&job.id, 10, Some("Fetching metadata"))
            .await?;

        // Get content and metadata
        let data = sqlx::query!(
            "SELECT content, ai_metadata FROM note_revised_current WHERE note_id = $1",
            note_id
        )
        .fetch_one(&self.pool)
        .await?;

        self.update_progress(&job.id, 30, Some("Creating semantic and keyword links"))
            .await?;

        // Create contextual links (both semantic and keyword-based)
        let metadata = data.ai_metadata.unwrap_or_else(|| serde_json::json!({}));
        crate::db_enhanced_v2::create_contextual_links(
            &self.state,
            note_id,
            &data.content,
            &metadata,
        )
        .await?;

        self.update_progress(&job.id, 70, Some("Updating with linked context"))
            .await?;

        // Update the note with context from linked articles
        crate::db_enhanced_v2::update_with_linked_context(&self.state, note_id).await?;

        self.update_progress(&job.id, 100, Some("Completed"))
            .await?;

        Ok(serde_json::json!({
            "note_id": note_id,
            "success": true
        }))
    }

    /// Process context update job
    async fn process_context_update(&self, job: &Job) -> anyhow::Result<serde_json::Value> {
        let note_id = job
            .note_id
            .ok_or_else(|| anyhow::anyhow!("No note_id for context update job"))?;

        self.update_progress(&job.id, 10, Some("Updating with linked context"))
            .await?;

        // Update with linked context
        crate::db_enhanced_v2::update_with_linked_context(&self.state, note_id).await?;

        self.update_progress(&job.id, 100, Some("Completed"))
            .await?;

        Ok(serde_json::json!({
            "note_id": note_id,
            "success": true
        }))
    }

    /// Process title generation job
    async fn process_title_generation(&self, job: &Job) -> anyhow::Result<serde_json::Value> {
        let note_id = job
            .note_id
            .ok_or_else(|| anyhow::anyhow!("No note_id for title generation job"))?;

        self.update_progress(&job.id, 10, Some("Fetching note and related notes"))
            .await?;

        // Get the current note data
        let note = crate::db::fetch_note(&self.state, note_id).await?;
        
        self.update_progress(&job.id, 30, Some("Finding related notes"))
            .await?;

        // Generate embedding for the note to find related notes
        let content = &note.revised.content;
        let embeddings = crate::ollama::embed_texts(vec![content.clone()], &self.state.embed_model).await?;
        let query_vec = embeddings
            .into_iter()
            .next()
            .unwrap_or_else(|| vec![0.0_f32; 768]);

        // Find related notes with >50% similarity
        let related_notes = crate::db::search_vector_filtered(&self.state, query_vec, None, 10).await?;
        let high_quality_related: Vec<_> = related_notes
            .into_iter()
            .filter(|hit| hit.score > 0.5 && hit.note_id != note_id)
            .take(5)
            .collect();

        self.update_progress(&job.id, 60, Some("Generating contextual title"))
            .await?;

        // Generate unique title using enhanced context and retry logic
        let title = crate::db_enhanced_v2::generate_unique_title(
            &self.state,
            note_id,
            content,
            &note.revised.ai_metadata.as_ref().unwrap_or(&serde_json::json!({})),
            &high_quality_related
        ).await?;

        self.update_progress(&job.id, 80, Some("Updating note title"))
            .await?;

        // Store the generated title
        crate::db_enhanced_v2::store_note_title(&self.state, note_id, &title).await?;

        self.update_progress(&job.id, 100, Some("Title generation completed"))
            .await?;

        Ok(serde_json::json!({
            "note_id": note_id,
            "title": title,
            "success": true
        }))
    }

    /// Update job progress
    async fn update_progress(
        &self,
        job_id: &Uuid,
        percent: i32,
        message: Option<&str>,
    ) -> anyhow::Result<()> {
        sqlx::query!(
            r#"
            UPDATE job_queue
            SET progress_percent = $1, progress_message = $2
            WHERE id = $3
            "#,
            percent,
            message,
            job_id
        )
        .execute(&self.pool)
        .await?;

        // Get note_id for this job
        let note_id =
            match sqlx::query_scalar!("SELECT note_id FROM job_queue WHERE id = $1", job_id)
                .fetch_optional(&self.pool)
                .await
            {
                Ok(Some(note_id)) => note_id,
                _ => None,
            };

        // Broadcast progress update via WebSocket
        broadcast_message(
            &self.state.ws_broadcaster,
            WsMessage::JobProgress {
                job_id: *job_id,
                note_id,
                progress_percent: percent,
                message: message.map(String::from),
            },
        );

        info!("Job {} progress: {}% - {:?}", job_id, percent, message);

        Ok(())
    }

    /// Record job history for estimation
    async fn record_job_history(
        &self,
        job_type: &JobType,
        duration_ms: i32,
        success: bool,
    ) -> anyhow::Result<()> {
        sqlx::query!(
            r#"
            INSERT INTO job_history (job_type, duration_ms, success, created_at)
            VALUES ($1, $2, $3, NOW())
            "#,
            &job_type as &JobType,
            duration_ms,
            success
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Broadcast current queue status
    async fn broadcast_queue_status(&self) -> anyhow::Result<()> {
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
        .fetch_one(&self.pool)
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
        .fetch_optional(&self.pool)
        .await?
        .map(|row| crate::websocket::ActiveJob {
            job_id: row.id,
            job_type: row.job_type,
            progress_percent: row.progress_percent,
            message: row.progress_message,
            started_at: row.started_at.unwrap_or_else(chrono::Utc::now),
        });

        broadcast_message(
            &self.state.ws_broadcaster,
            WsMessage::QueueStatus {
                total_jobs: stats.total as usize,
                running: stats.running as usize,
                pending: stats.pending as usize,
                active_job,
            },
        );

        Ok(())
    }

    /// Broadcast note update after job completion
    async fn broadcast_note_update(&self, note_id: Uuid) -> anyhow::Result<()> {
        // Get updated note information
        let note_info = sqlx::query!(
            r#"
            SELECT 
                LEFT(COALESCE(no.content, 'Untitled'), 50) as title,
                COALESCE(array_agg(DISTINCT nt.tag_name) FILTER (WHERE nt.tag_name IS NOT NULL), ARRAY[]::text[]) as tags,
                CASE WHEN nrc.content IS NOT NULL THEN true ELSE false END as has_ai_content,
                CASE WHEN EXISTS(SELECT 1 FROM link WHERE from_note_id = n.id) THEN true ELSE false END as has_links
            FROM note n
            LEFT JOIN note_original no ON no.note_id = n.id
            LEFT JOIN note_tag nt ON nt.note_id = n.id
            LEFT JOIN note_revised_current nrc ON nrc.note_id = n.id
            WHERE n.id = $1
            GROUP BY n.id, no.content, nrc.content
            "#,
            note_id
        )
        .fetch_optional(&self.pool)
        .await?;

        if let Some(info) = note_info {
            broadcast_message(
                &self.state.ws_broadcaster,
                crate::websocket::WsMessage::NoteUpdated {
                    note_id,
                    title: info.title.unwrap_or_else(|| "Untitled".to_string()),
                    tags: info.tags.unwrap_or_default(),
                    has_ai_content: info.has_ai_content.unwrap_or(false),
                    has_links: info.has_links.unwrap_or(false),
                },
            );
        }

        Ok(())
    }

    /// Broadcast progress updates periodically
    async fn broadcast_progress_loop(&self) {
        loop {
            // Get all active jobs
            let active_jobs = sqlx::query!(
                r#"
                SELECT id, status as "status: JobStatus", progress_percent
                FROM job_queue
                WHERE status IN ('pending'::job_status, 'running'::job_status)
                "#
            )
            .fetch_all(&self.pool)
            .await;

            if let Ok(jobs) = active_jobs {
                // Here we would broadcast to WebSocket clients
                // For now, just log
                if !jobs.is_empty() {
                    info!("Active jobs: {}", jobs.len());
                }
            }

            sleep(Duration::from_secs(2)).await;
        }
    }
}

/// Queue a new job
pub async fn queue_job(
    pool: &PgPool,
    note_id: Option<Uuid>,
    job_type: JobType,
    priority: i32,
    payload: Option<serde_json::Value>,
) -> anyhow::Result<Uuid> {
    // Estimate duration based on history
    let estimated_duration = sqlx::query_scalar!(
        "SELECT estimate_job_duration($1::job_type, NULL)",
        &job_type as &JobType
    )
    .fetch_one(pool)
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
    .execute(pool)
    .await?;

    info!("Queued job {} of type {:?}", job_id, job_type);

    Ok(job_id)
}

/// Get job queue status
pub async fn get_queue_status(pool: &PgPool) -> anyhow::Result<Vec<serde_json::Value>> {
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
    .fetch_all(pool)
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

/// Cancel a job
pub async fn cancel_job(pool: &PgPool, job_id: Uuid) -> anyhow::Result<()> {
    sqlx::query!(
        r#"
        UPDATE job_queue
        SET status = 'cancelled'::job_status,
            completed_at = NOW()
        WHERE id = $1 AND status = 'pending'::job_status
        "#,
        job_id
    )
    .execute(pool)
    .await?;

    Ok(())
}
