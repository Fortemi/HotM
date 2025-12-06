use crate::models::*;
use crate::websocket::WsBroadcaster;
use chrono::{DateTime, Utc};
use hex;
use sha2::{Digest, Sha256};
use sqlx::{Pool, Postgres, Row};
use uuid::Uuid;

const DEFAULT_EMBED_MODEL: &str = "nomic-embed-text";
const DEFAULT_GEN_MODEL: &str = "gpt-oss:20b";

#[derive(Clone)]
pub struct AppState {
    pub pool: Pool<Postgres>,
    pub embed_model: String,
    pub ollama_base: String,
    pub gen_model: String,
    pub ws_broadcaster: WsBroadcaster,
}

impl AppState {
    pub async fn connect(url: &str, ws_broadcaster: WsBroadcaster) -> anyhow::Result<Self> {
        let pool = sqlx::postgres::PgPoolOptions::new()
            .max_connections(10)
            .connect(url)
            .await?;
        // Run migrations - skip if schema already exists (clean-schema.sql rebuild)
        // This allows both migration-based and greenfield schema approaches to work
        match sqlx::migrate!().run(&pool).await {
            Ok(_) => tracing::info!("Migrations applied successfully"),
            Err(e) => {
                // Check if the error is because types/tables already exist (greenfield rebuild)
                let err_msg = format!("{}", e);
                if err_msg.contains("already exists") {
                    tracing::info!("Schema already exists (likely from clean-schema.sql rebuild), skipping migrations");
                } else {
                    return Err(e.into());
                }
            }
        }
        let embed_model =
            std::env::var("OLLAMA_EMBED_MODEL").unwrap_or_else(|_| DEFAULT_EMBED_MODEL.to_string());
        let gen_model =
            std::env::var("OLLAMA_GEN_MODEL").unwrap_or_else(|_| DEFAULT_GEN_MODEL.to_string());
        let ollama_base =
            std::env::var("OLLAMA_BASE").unwrap_or_else(|_| "http://127.0.0.1:11434".to_string());
        Ok(Self {
            pool,
            embed_model,
            ollama_base,
            gen_model,
            ws_broadcaster,
        })
    }
}

pub async fn insert_note(
    state: &AppState,
    content: &str,
    format: &str,
    source: &str,
) -> anyhow::Result<Uuid> {
    let note_id = Uuid::new_v4();
    let now: DateTime<Utc> = Utc::now();
    let mut tx = state.pool.begin().await?;

    sqlx::query!(
        "INSERT INTO note (id, collection_id, format, source, created_at_utc, updated_at_utc) VALUES ($1, NULL, $2, $3, $4, $4)",
        note_id, format, source, now
    ).execute(&mut *tx).await?;

    let mut hasher = Sha256::new();
    hasher.update(content.as_bytes());
    let hash = format!("sha256:{}", hex::encode(hasher.finalize()));

    sqlx::query!(
        "INSERT INTO note_original (note_id, content, hash) VALUES ($1, $2, $3)",
        note_id,
        content,
        hash
    )
    .execute(&mut *tx)
    .await?;

    // Initial revised equals original; NLP pipeline can update later
    sqlx::query!(
        "INSERT INTO note_revised_current (note_id, content, last_revision_id) VALUES ($1, $2, NULL)",
        note_id, content
    ).execute(&mut *tx).await?;

    sqlx::query!(
        "INSERT INTO activity_log (id, at_utc, actor, action, note_id, meta) VALUES ($1, $2, 'user', 'create_note', $3, '{}'::jsonb)",
        Uuid::new_v4(), now, note_id
    ).execute(&mut *tx).await?;

    tx.commit().await?;

    // Queue jobs for NLP enhancement pipeline instead of running directly
    use crate::job_queue::{queue_job, JobType};

    // Queue AI revision job with high priority
    if let Err(e) = queue_job(&state.pool, Some(note_id), JobType::AiRevision, 8, None).await {
        tracing::warn!(
            "Failed to queue AI revision job for note {}: {}",
            note_id,
            e
        );
    }

    // Queue embedding generation with medium priority
    if let Err(e) = queue_job(&state.pool, Some(note_id), JobType::Embedding, 5, None).await {
        tracing::warn!("Failed to queue embedding job for note {}: {}", note_id, e);
    }

    // Queue link detection with lower priority
    if let Err(e) = queue_job(&state.pool, Some(note_id), JobType::Linking, 3, None).await {
        tracing::warn!("Failed to queue linking job for note {}: {}", note_id, e);
    }

    // Queue title generation after other processing is complete (lowest priority)
    if let Err(e) = queue_job(&state.pool, Some(note_id), JobType::TitleGeneration, 2, None).await {
        tracing::warn!("Failed to queue title generation job for note {}: {}", note_id, e);
    }

    tracing::info!("Queued jobs for note {}", note_id);
    Ok(note_id)
}

pub async fn update_original_content(
    state: &AppState,
    note_id: Uuid,
    content: &str,
) -> anyhow::Result<()> {
    let now = Utc::now();
    
    // Calculate new hash
    let mut hasher = Sha256::new();
    hasher.update(content.as_bytes());
    let hash = format!("sha256:{}", hex::encode(hasher.finalize()));
    
    let mut tx = state.pool.begin().await?;

    // Update the original content
    sqlx::query!(
        "UPDATE note_original SET content = $1, hash = $2, user_last_edited_at = $3 WHERE note_id = $4",
        content,
        hash,
        now,
        note_id
    )
    .execute(&mut *tx)
    .await?;

    // Update note's updated_at timestamp
    sqlx::query!(
        "UPDATE note SET updated_at_utc = $1 WHERE id = $2",
        now,
        note_id
    )
    .execute(&mut *tx)
    .await?;

    // Log the activity
    sqlx::query!(
        "INSERT INTO activity_log (id, at_utc, actor, action, note_id, meta) VALUES ($1, $2, 'user', 'update_original', $3, '{}'::jsonb)",
        Uuid::new_v4(), 
        now, 
        note_id
    )
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    tracing::info!("Updated original content for note {}", note_id);
    Ok(())
}

pub async fn list_notes(
    state: &AppState,
    req: &ListNotesRequest,
) -> anyhow::Result<ListNotesResponse> {
    let sort_by = req.sort_by.as_deref().unwrap_or("created_at_utc");
    let sort_order = req.sort_order.as_deref().unwrap_or("desc");
    let filter = req.filter.as_deref().unwrap_or("all");
    let limit = req.limit.unwrap_or(50).min(100);
    let offset = req.offset.unwrap_or(0);

    // Build the filter clause (always exclude soft-deleted notes unless explicitly requested)
    let filter_clause = match filter {
        "starred" => "AND n.starred = true AND n.archived = false AND n.deleted_at IS NULL",
        "archived" => "AND n.archived = true AND n.deleted_at IS NULL",
        "recent" => "AND n.last_accessed_at IS NOT NULL AND n.archived = false AND n.deleted_at IS NULL",
        "deleted" | "trash" => "AND n.deleted_at IS NOT NULL", // Show only soft-deleted notes
        _ => "AND n.deleted_at IS NULL", // "all" filter shows non-deleted notes
    };

    // Build the order clause
    let order_clause = match sort_by {
        "updated_at" => format!("n.updated_at_utc {}", sort_order),
        "accessed_at" => format!(
            "COALESCE(n.last_accessed_at, n.created_at_utc) {}",
            sort_order
        ),
        _ => format!("n.created_at_utc {}", sort_order),
    };

    // Get total count
    let count_query = format!(
        "SELECT COUNT(*) as count FROM note n WHERE TRUE {}",
        filter_clause
    );
    let total = sqlx::query_scalar::<_, i64>(&count_query)
        .fetch_one(&state.pool)
        .await?;

    // Get notes with summaries
    let notes_query = format!(
        r#"
        SELECT 
            n.id, 
            n.created_at_utc, 
            n.updated_at_utc, 
            n.starred, 
            n.archived,
            n.title,
            n.metadata,
            no.content as original_content,
            nrc.content as revised_content,
            nrc.ai_metadata,
            COALESCE(
                (SELECT string_agg(tag_name, ',') FROM note_tag WHERE note_id = n.id),
                ''
            ) as tags
        FROM note n
        JOIN note_original no ON no.note_id = n.id
        LEFT JOIN note_revised_current nrc ON nrc.note_id = n.id
        WHERE TRUE {}
        ORDER BY {}
        LIMIT {} OFFSET {}
        "#,
        filter_clause, order_clause, limit, offset
    );

    let rows = sqlx::query(&notes_query).fetch_all(&state.pool).await?;

    let mut notes = Vec::new();
    for row in rows {
        let id: Uuid = row.try_get("id")?;
        let original_content: String = row.try_get("original_content")?;
        let revised_content: Option<String> = row.try_get("revised_content").ok();
        let content = revised_content.as_ref().unwrap_or(&original_content);

        // Use stored title or extract from first line as fallback
        let stored_title: Option<String> = row.try_get("title").ok().flatten();
        let title = stored_title.unwrap_or_else(|| {
            content
                .lines()
                .next()
                .map(|l| l.trim_start_matches('#').trim())
                .unwrap_or("Untitled")
                .to_string()
        });

        // Create snippet (first 200 chars after title)
        let snippet = content
            .lines()
            .skip(1)
            .collect::<Vec<_>>()
            .join(" ")
            .chars()
            .take(200)
            .collect::<String>();

        let tags_str: String = row.try_get("tags").unwrap_or_default();
        let tags: Vec<String> = if tags_str.is_empty() {
            Vec::new()
        } else {
            tags_str.split(',').map(|s| s.to_string()).collect()
        };

        notes.push(NoteSummary {
            id,
            title,
            snippet,
            created_at_utc: row.try_get("created_at_utc")?,
            updated_at_utc: row.try_get("updated_at_utc")?,
            starred: row.try_get("starred")?,
            archived: row.try_get("archived")?,
            tags,
            has_revision: revised_content.is_some(),
            metadata: row.try_get("metadata")?,
        });
    }

    Ok(ListNotesResponse { notes, total })
}

pub async fn fetch_note(state: &AppState, note_id: Uuid) -> anyhow::Result<NoteFull> {
    // Update last accessed timestamp
    sqlx::query!(
        "UPDATE note SET last_accessed_at = $1 WHERE id = $2",
        Utc::now(),
        note_id
    )
    .execute(&state.pool)
    .await?;

    let note = sqlx::query!(
        "SELECT id, collection_id, format, source, created_at_utc, updated_at_utc, starred, archived, last_accessed_at, title, metadata FROM note WHERE id = $1",
        note_id
    ).fetch_one(&state.pool).await?;

    let original = sqlx::query!(
        "SELECT content, hash, user_created_at, user_last_edited_at FROM note_original WHERE note_id = $1",
        note_id
    ).fetch_one(&state.pool).await?;

    // Get current revised content - this table always contains the most up-to-date content
    let current = sqlx::query!(
        "SELECT nrc.content, nrc.last_revision_id, nrc.ai_metadata, nr.model 
         FROM note_revised_current nrc
         LEFT JOIN note_revision nr ON nr.id = nrc.last_revision_id
         WHERE nrc.note_id = $1",
        note_id
    ).fetch_one(&state.pool).await?;

    let revised = (
        current.content,
        current.last_revision_id,
        current.ai_metadata,
        current.model,
    );

    let tags = sqlx::query!("SELECT tag_name FROM note_tag WHERE note_id = $1", note_id)
        .fetch_all(&state.pool)
        .await?
        .into_iter()
        .map(|r| r.tag_name)
        .collect();

    let links = sqlx::query!(
        r#"SELECT 
            l.id, 
            l.from_note_id, 
            l.to_note_id, 
            l.to_url, 
            l.kind, 
            l.score, 
            l.created_at_utc,
            l.metadata,
            COALESCE(
                substring(nrc.content from 1 for 100),
                'Linked note'
            ) as snippet
        FROM link l
        LEFT JOIN note_revised_current nrc ON nrc.note_id = l.to_note_id
        WHERE l.from_note_id = $1
        ORDER BY l.score DESC, l.created_at_utc DESC"#,
        note_id
    )
    .fetch_all(&state.pool)
    .await?;

    let links: Vec<Link> = links
        .into_iter()
        .map(|r| Link {
            id: r.id,
            from_note_id: r.from_note_id.unwrap(), // from_note_id is NOT NULL in schema
            to_note_id: r.to_note_id,
            to_url: r.to_url,
            kind: r.kind,
            score: r.score, // Convert from f64 to f32
            created_at_utc: r.created_at_utc,
            snippet: r.snippet,
            metadata: r.metadata,
        })
        .collect();

    Ok(NoteFull {
        note: NoteMeta {
            id: note.id,
            collection_id: note.collection_id,
            format: note.format,
            source: note.source,
            created_at_utc: note.created_at_utc,
            updated_at_utc: note.updated_at_utc,
            starred: note.starred.unwrap_or(false),
            archived: note.archived.unwrap_or(false),
            last_accessed_at: note.last_accessed_at,
            title: note.title,
            metadata: note.metadata, // metadata is NOT NULL with default
        },
        original: NoteOriginal {
            content: original.content,
            hash: original.hash,
            user_created_at: original.user_created_at,
            user_last_edited_at: original.user_last_edited_at,
        },
        revised: NoteRevised {
            content: revised.0,
            last_revision_id: revised.1,
            ai_metadata: revised.2,
            ai_generated_at: None,     // TODO: fetch from note_revision
            user_last_edited_at: None, // TODO: fetch from note_revision
            is_user_edited: false,     // TODO: fetch from note_revision
            generation_count: 1,       // TODO: fetch from note_revision
            model: revised.3,
        },
        tags,
        links,
    })
}

pub async fn update_note_status(
    state: &AppState,
    note_id: Uuid,
    req: &UpdateNoteStatusRequest,
) -> anyhow::Result<()> {
    let mut qb = sqlx::QueryBuilder::new("UPDATE note SET updated_at_utc = ");
    qb.push_bind(Utc::now());

    if let Some(starred) = req.starred {
        qb.push(", starred = ");
        qb.push_bind(starred);
    }

    if let Some(archived) = req.archived {
        qb.push(", archived = ");
        qb.push_bind(archived);
    }

    qb.push(" WHERE id = ");
    qb.push_bind(note_id);

    qb.build().execute(&state.pool).await?;
    Ok(())
}

pub async fn update_revised(
    state: &AppState,
    note_id: Uuid,
    content: &str,
    rationale: Option<&str>,
) -> anyhow::Result<Uuid> {
    let now = Utc::now();
    let revision_id = Uuid::new_v4();
    let mut tx = state.pool.begin().await?;

    sqlx::query!(
        "INSERT INTO note_revision (id, note_id, parent_revision_id, revision_number, content, type, created_at_utc, summary, rationale) VALUES ($1, $2, (SELECT last_revision_id FROM note_revised_current WHERE note_id = $2), COALESCE((SELECT MAX(revision_number) + 1 FROM note_revision WHERE note_id = $2), 1), $3, 'manual', $4, NULL, $5)",
        revision_id, note_id, content, now, rationale
    ).execute(&mut *tx).await?;

    sqlx::query!(
        "UPDATE note_revised_current SET content = $1, last_revision_id = $2 WHERE note_id = $3",
        content,
        revision_id,
        note_id
    )
    .execute(&mut *tx)
    .await?;

    sqlx::query!(
        "UPDATE note SET updated_at_utc = $1 WHERE id = $2",
        now,
        note_id
    )
    .execute(&mut *tx)
    .await?;

    sqlx::query!(
        "INSERT INTO activity_log (id, at_utc, actor, action, note_id, meta) VALUES ($1, $2, 'user', 'revise', $3, '{}'::jsonb)",
        Uuid::new_v4(), now, note_id
    ).execute(&mut *tx).await?;

    tx.commit().await?;

    // If rationale contains "AI", trigger AI regeneration
    if rationale
        .map(|r| r.contains("AI") || r.contains("regenerat"))
        .unwrap_or(false)
    {
        // Generate AI revision asynchronously
        let state_clone = state.clone();
        let content_clone = content.to_string();
        tokio::spawn(async move {
            if let Err(err) = generate_ai_revision(&state_clone, note_id, &content_clone).await {
                tracing::warn!(%note_id, error = %format!("{}", err), "AI revision generation failed");
            }
        });
    }

    // Re-embed current content (best-effort)
    if let Err(err) = embed_note(&self_from_state(state), note_id, content).await {
        tracing::warn!(%note_id, error = %format!("{}", err), "embedding failed; continuing without vectors");
    }
    Ok(revision_id)
}

pub async fn search_fts(state: &AppState, q: &str, limit: i64) -> anyhow::Result<Vec<SearchHit>> {
    // Use plainto_tsquery for safety - runtime query for soft delete compatibility
    let rows = sqlx::query(
        r#"
        SELECT n.id as note_id,
               ts_rank(nrc.tsv, plainto_tsquery('english', $1)) AS score,
               substring(nrc.content for 200) AS snippet
        FROM note_revised_current nrc
        JOIN note n ON n.id = nrc.note_id
        WHERE nrc.tsv @@ plainto_tsquery('english', $1)
          AND (n.archived IS FALSE OR n.archived IS NULL)
          AND n.deleted_at IS NULL
        ORDER BY score DESC
        LIMIT $2
        "#,
    )
    .bind(q)
    .bind(limit)
    .fetch_all(&state.pool)
    .await?;

    let mut results = Vec::new();
    for row in rows {
        let note_id: Uuid = row.try_get("note_id")?;
        let score: f32 = row.try_get::<Option<f32>, _>("score")?.unwrap_or(0.0);
        let snippet: Option<String> = row.try_get("snippet")?;
        results.push(SearchHit {
            note_id,
            score,
            snippet,
        });
    }
    Ok(results)
}

pub async fn search_fts_filtered(
    state: &AppState,
    q: &str,
    filters: Option<&str>,
    limit: i64,
) -> anyhow::Result<Vec<SearchHit>> {
    // Basic filter parser: tag:foo, collection:uuid
    let mut qb = sqlx::QueryBuilder::new(
        "SELECT n.id as note_id, ts_rank(nrc.tsv, plainto_tsquery('english', ",
    );
    qb.push_bind(q);
    qb.push(")) AS score, substring(nrc.content for 200) AS snippet FROM note_revised_current nrc JOIN note n ON n.id = nrc.note_id WHERE nrc.tsv @@ plainto_tsquery('english', ");
    qb.push_bind(q);
    qb.push(") AND (n.archived IS FALSE OR n.archived IS NULL) AND n.deleted_at IS NULL");

    if let Some(f) = filters {
        for token in f.split_whitespace() {
            if let Some(rest) = token.strip_prefix("tag:") {
                qb.push(" AND n.id IN (SELECT note_id FROM note_tag WHERE tag_name = ");
                qb.push_bind(rest);
                qb.push(")");
            } else if let Some(rest) = token.strip_prefix("collection:") {
                qb.push(" AND n.collection_id = ");
                qb.push_bind(Uuid::parse_str(rest)?);
            }
        }
    }
    qb.push(" ORDER BY score DESC LIMIT ");
    qb.push_bind(limit);
    let rows = qb.build().fetch_all(&state.pool).await?;
    let mut out = Vec::new();
    for row in rows {
        let note_id: Uuid = row.try_get("note_id")?;
        let score: Option<f32> = row.try_get("score")?;
        let snippet: Option<String> = row.try_get("snippet")?;
        out.push(SearchHit {
            note_id,
            score: score.unwrap_or(0.0),
            snippet,
        });
    }
    Ok(out)
}

// Helper to get a clone of AppState (for internal calls)
fn self_from_state(state: &AppState) -> AppState {
    state.clone()
}

fn chunk_text(text: &str, max_len: usize) -> Vec<String> {
    if text.is_empty() {
        return vec![];
    }
    let mut chunks = Vec::new();
    let mut start = 0;
    let bytes = text.as_bytes();
    while start < bytes.len() {
        let end = (start + max_len).min(bytes.len());
        let chunk = &text[start..end];
        chunks.push(chunk.to_string());
        start = end;
    }
    chunks
}

pub async fn embed_note(state: &AppState, note_id: Uuid, content: &str) -> anyhow::Result<()> {
    // delete previous embeddings for this note
    sqlx::query!("DELETE FROM embedding WHERE note_id = $1", note_id)
        .execute(&state.pool)
        .await?;

    let chunks = chunk_text(content, 1500); // ~roughly ~1000 tokens depending on content
    if chunks.is_empty() {
        return Ok(());
    }

    let vectors = crate::ollama::embed_texts(chunks.clone(), &state.embed_model).await?;

    let mut tx = state.pool.begin().await?;
    for (i, vec) in vectors.into_iter().enumerate() {
        // Use runtime query for pgvector type
        sqlx::query(
            "INSERT INTO embedding (id, note_id, chunk_index, text, vector, model) VALUES ($1, $2, $3, $4, $5, $6)"
        )
        .bind(Uuid::new_v4())
        .bind(note_id)
        .bind(i as i32)
        .bind(&chunks[i])
        .bind(pgvector::Vector::from(vec))
        .bind(&state.embed_model)
        .execute(&mut *tx).await?;
    }
    tx.commit().await?;
    Ok(())
}

pub async fn search_vector(
    state: &AppState,
    query_vec: Vec<f32>,
    limit: i64,
) -> anyhow::Result<Vec<SearchHit>> {
    // Use runtime query for pgvector type
    let rows = sqlx::query(
        r#"
        SELECT e.note_id AS note_id,
               1.0 - (e.vector <=> $1::vector) AS score
        FROM embedding e
        JOIN note n ON n.id = e.note_id
        WHERE (n.archived IS FALSE OR n.archived IS NULL)
          AND n.deleted_at IS NULL
        ORDER BY e.vector <=> $1::vector
        LIMIT $2
        "#,
    )
    .bind(pgvector::Vector::from(query_vec))
    .bind(limit)
    .fetch_all(&state.pool)
    .await?;

    let mut results = Vec::new();
    for row in rows {
        let note_id: Uuid = row.try_get("note_id")?;
        let score: f64 = row.try_get("score")?;
        results.push(SearchHit {
            note_id,
            score: score as f32,
            snippet: None,
        });
    }
    Ok(results)
}

pub async fn search_vector_filtered(
    state: &AppState,
    query_vec: Vec<f32>,
    filters: Option<&str>,
    limit: i64,
) -> anyhow::Result<Vec<SearchHit>> {
    let vec_param = pgvector::Vector::from(query_vec.clone());
    let mut qb = sqlx::QueryBuilder::new("SELECT e.note_id AS note_id, 1.0 - (e.vector <=> ");
    qb.push_bind(vec_param.clone());
    qb.push("::vector) AS score FROM embedding e JOIN note n ON n.id = e.note_id WHERE (n.archived IS FALSE OR n.archived IS NULL) AND n.deleted_at IS NULL");

    if let Some(f) = filters {
        for token in f.split_whitespace() {
            if let Some(rest) = token.strip_prefix("tag:") {
                qb.push(" AND e.note_id IN (SELECT note_id FROM note_tag WHERE tag_name = ");
                qb.push_bind(rest);
                qb.push(")");
            } else if let Some(rest) = token.strip_prefix("collection:") {
                qb.push(" AND n.collection_id = ");
                qb.push_bind(Uuid::parse_str(rest)?);
            }
        }
    }
    qb.push(" ORDER BY e.vector <=> ");
    qb.push_bind(vec_param);
    qb.push("::vector ASC LIMIT ");
    qb.push_bind(limit);
    let rows = qb.build().fetch_all(&state.pool).await?;
    let mut out = Vec::new();
    for row in rows {
        let note_id: Uuid = row.try_get("note_id")?;
        let score: f64 = row.try_get("score")?;
        out.push(SearchHit {
            note_id,
            score: score as f32,
            snippet: None,
        });
    }
    Ok(out)
}

pub async fn generate_ai_revision(
    state: &AppState,
    note_id: Uuid,
    content: &str,
) -> anyhow::Result<()> {
    // Create a prompt for the AI to enhance the note
    let prompt = format!(
        r#"You are an intelligent note-taking assistant. Your task is to enhance and organize the following note while preserving all important information.

Original Note:
{}

Please provide an enhanced version that:
1. Preserves ALL original information and meaning
2. Improves clarity and organization  
3. Adds proper markdown formatting (headers, lists, emphasis)
4. Identifies and highlights key concepts
5. Adds relevant context or connections if apparent
6. Formats any code blocks, math expressions, or diagrams properly
7. Maintains a professional yet accessible tone

Output the enhanced note in clean markdown format. Do not add explanatory text before or after the note."#,
        content
    );

    // Generate the AI revision
    let revised_content = crate::ollama::generate(&state.gen_model, &prompt).await?;

    // Store the revised content
    let revision_id = Uuid::new_v4();
    let now = Utc::now();

    let mut tx = state.pool.begin().await?;

    // Insert revision record
    sqlx::query!(
        "INSERT INTO note_revision (id, note_id, created_at_utc, rationale, content, type, model) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        revision_id, note_id, now, "AI-enhanced revision", revised_content, "ai_enhancement", state.gen_model
    ).execute(&mut *tx).await?;

    // Update current revised content
    sqlx::query!(
        "UPDATE note_revised_current SET content = $1, last_revision_id = $2 WHERE note_id = $3",
        revised_content,
        revision_id,
        note_id
    )
    .execute(&mut *tx)
    .await?;

    // Log the revision
    sqlx::query!(
        "INSERT INTO activity_log (id, at_utc, actor, action, note_id, meta) VALUES ($1, $2, 'ai', 'revise_note', $3, '{}'::jsonb)",
        Uuid::new_v4(), now, note_id
    ).execute(&mut *tx).await?;

    tx.commit().await?;

    // Generate embeddings for the revised content
    if let Err(err) = embed_note(&self_from_state(state), note_id, &revised_content).await {
        tracing::warn!(%note_id, error = %format!("{}", err), "embedding revised content failed");
    }

    tracing::info!(%note_id, "AI revision generated successfully");
    Ok(())
}
