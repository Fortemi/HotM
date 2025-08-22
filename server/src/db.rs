use sqlx::{Pool, Postgres, Row};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use crate::models::*;
use sha2::{Sha256, Digest};
use hex;

const DEFAULT_EMBED_MODEL: &str = "nomic-embed-text";
const DEFAULT_GEN_MODEL: &str = "gpt-oss:20b";

#[derive(Clone)]
pub struct AppState {
    pub pool: Pool<Postgres>,
    pub embed_model: String,
    pub ollama_base: String,
    pub gen_model: String,
}

impl AppState {
    pub async fn connect(url: &str) -> anyhow::Result<Self> {
        let pool = sqlx::postgres::PgPoolOptions::new()
            .max_connections(10)
            .connect(url)
            .await?;
        // Run migrations
        sqlx::migrate!().run(&pool).await?;
        let embed_model = std::env::var("OLLAMA_EMBED_MODEL").unwrap_or_else(|_| DEFAULT_EMBED_MODEL.to_string());
        let gen_model = std::env::var("OLLAMA_GEN_MODEL").unwrap_or_else(|_| DEFAULT_GEN_MODEL.to_string());
        let ollama_base = std::env::var("OLLAMA_BASE").unwrap_or_else(|_| "http://127.0.0.1:11434".to_string());
        Ok(Self { pool, embed_model, ollama_base, gen_model })
    }
}

pub async fn insert_note(state: &AppState, content: &str, format: &str, source: &str) -> anyhow::Result<Uuid> {
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
        note_id, content, hash
    ).execute(&mut *tx).await?;

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

    // Generate AI revision with metadata asynchronously
    let state_clone = state.clone();
    let content_clone = content.to_string();
    tokio::spawn(async move {
        if let Err(err) = crate::db_enhanced::generate_ai_revision_with_metadata(&state_clone, note_id, &content_clone).await {
            tracing::warn!(%note_id, error = %format!("{}", err), "AI revision generation failed");
        }
    });

    // Compute and store embeddings for the revised content (best-effort)
    // This is non-critical, so we just log if it fails
    if let Err(err) = embed_note(&self_from_state(state), note_id, content).await {
        tracing::warn!(%note_id, error = %format!("{}", err), "embedding failed; continuing without vectors. Make sure nomic-embed-text model is installed: ollama pull nomic-embed-text");
    }
    Ok(note_id)
}

pub async fn list_notes(state: &AppState, req: &ListNotesRequest) -> anyhow::Result<ListNotesResponse> {
    let sort_by = req.sort_by.as_deref().unwrap_or("created_at_utc");
    let sort_order = req.sort_order.as_deref().unwrap_or("desc");
    let filter = req.filter.as_deref().unwrap_or("all");
    let limit = req.limit.unwrap_or(50).min(100);
    let offset = req.offset.unwrap_or(0);
    
    // Build the filter clause
    let filter_clause = match filter {
        "starred" => "AND n.starred = true AND n.archived = false",
        "archived" => "AND n.archived = true",
        "recent" => "AND n.last_accessed_at IS NOT NULL AND n.archived = false",
        _ => "AND n.archived = false", // Default to non-archived
    };
    
    // Build the order clause
    let order_clause = match sort_by {
        "updated_at" => format!("n.updated_at_utc {}", sort_order),
        "accessed_at" => format!("COALESCE(n.last_accessed_at, n.created_at_utc) {}", sort_order),
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
    
    let rows = sqlx::query(&notes_query)
        .fetch_all(&state.pool)
        .await?;
    
    let mut notes = Vec::new();
    for row in rows {
        let id: Uuid = row.try_get("id")?;
        let original_content: String = row.try_get("original_content")?;
        let revised_content: Option<String> = row.try_get("revised_content").ok();
        let content = revised_content.as_ref().unwrap_or(&original_content);
        
        // Extract title from first line
        let title = content.lines()
            .next()
            .map(|l| l.trim_start_matches('#').trim())
            .unwrap_or("Untitled")
            .to_string();
        
        // Create snippet (first 200 chars after title)
        let snippet = content.lines()
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
        Utc::now(), note_id
    ).execute(&state.pool).await?;
    
    let note = sqlx::query!(
        "SELECT id, collection_id, format, source, created_at_utc, updated_at_utc, starred, archived, last_accessed_at, metadata FROM note WHERE id = $1",
        note_id
    ).fetch_one(&state.pool).await?;

    let original = sqlx::query!(
        "SELECT content, hash FROM note_original WHERE note_id = $1",
        note_id
    ).fetch_one(&state.pool).await?;

    // Try to get the latest AI revision first, fallback to current revised
    let ai_revision = sqlx::query!(
        "SELECT content, id as last_revision_id FROM note_revision 
         WHERE note_id = $1 AND type = 'ai_enhancement'
         ORDER BY created_at_utc DESC LIMIT 1",
        note_id
    ).fetch_optional(&state.pool).await?;
    
    // Get current revised with metadata
    let current = sqlx::query!(
        "SELECT content, last_revision_id, ai_metadata FROM note_revised_current WHERE note_id = $1",
        note_id
    ).fetch_one(&state.pool).await?;
    
    let revised = if let Some(ai_rev) = ai_revision {
        // Use AI revision if available but keep metadata from current
        (ai_rev.content, Some(ai_rev.last_revision_id), current.ai_metadata)
    } else {
        // Use current revised
        (current.content, current.last_revision_id, current.ai_metadata)
    };

    let tags = sqlx::query!(
        "SELECT tag_name FROM note_tag WHERE note_id = $1",
        note_id
    ).fetch_all(&state.pool).await?.into_iter().map(|r| r.tag_name).collect();

    let links = sqlx::query!(
        "SELECT id, from_note_id, to_note_id, to_url, kind, score, created_at_utc FROM link WHERE from_note_id = $1",
        note_id
    ).fetch_all(&state.pool).await?;

    let links: Vec<Link> = links.into_iter().map(|r| Link{
        id: r.id,
        from_note_id: r.from_note_id,
        to_note_id: r.to_note_id,
        to_url: r.to_url,
        kind: r.kind,
        score: r.score,
        created_at_utc: r.created_at_utc,
    }).collect();

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
            metadata: note.metadata.unwrap_or(serde_json::json!({})),
        },
        original: NoteOriginal { content: original.content, hash: original.hash },
        revised: NoteRevised { 
            content: revised.0, 
            last_revision_id: revised.1,
            ai_metadata: revised.2,
        },
        tags,
        links,
    })
}

pub async fn update_note_status(state: &AppState, note_id: Uuid, req: &UpdateNoteStatusRequest) -> anyhow::Result<()> {
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

pub async fn update_revised(state: &AppState, note_id: Uuid, content: &str, rationale: Option<&str>) -> anyhow::Result<Uuid> {
    let now = Utc::now();
    let revision_id = Uuid::new_v4();
    let mut tx = state.pool.begin().await?;

    sqlx::query!(
        "INSERT INTO note_revision (id, note_id, parent_revision_id, content, type, created_at_utc, summary, rationale) VALUES ($1, $2, (SELECT last_revision_id FROM note_revised_current WHERE note_id = $2), $3, 'manual', $4, NULL, $5)",
        revision_id, note_id, content, now, rationale
    ).execute(&mut *tx).await?;

    sqlx::query!(
        "UPDATE note_revised_current SET content = $1, last_revision_id = $2 WHERE note_id = $3",
        content, revision_id, note_id
    ).execute(&mut *tx).await?;

    sqlx::query!(
        "UPDATE note SET updated_at_utc = $1 WHERE id = $2",
        now, note_id
    ).execute(&mut *tx).await?;

    sqlx::query!(
        "INSERT INTO activity_log (id, at_utc, actor, action, note_id, meta) VALUES ($1, $2, 'user', 'revise', $3, '{}'::jsonb)",
        Uuid::new_v4(), now, note_id
    ).execute(&mut *tx).await?;

    tx.commit().await?;

    // If rationale contains "AI", trigger AI regeneration
    if rationale.map(|r| r.contains("AI") || r.contains("regenerat")).unwrap_or(false) {
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
    // Use plainto_tsquery for safety
    let rows = sqlx::query!(
        r#"
        SELECT n.id as note_id,
               ts_rank(nrc.tsv, plainto_tsquery('english', $1)) AS score,
               substring(nrc.content for 200) AS snippet
        FROM note_revised_current nrc
        JOIN note n ON n.id = nrc.note_id
        WHERE nrc.tsv @@ plainto_tsquery('english', $1)
        ORDER BY score DESC
        LIMIT $2
        "#,
        q,
        limit
    ).fetch_all(&state.pool).await?;

    Ok(rows.into_iter().map(|r| SearchHit { note_id: r.note_id, score: r.score.unwrap_or(0.0), snippet: r.snippet }).collect())
}

pub async fn search_fts_filtered(state: &AppState, q: &str, filters: Option<&str>, limit: i64) -> anyhow::Result<Vec<SearchHit>> {
    // Basic filter parser: tag:foo, collection:uuid
    let mut qb = sqlx::QueryBuilder::new(
        "SELECT n.id as note_id, ts_rank(nrc.tsv, plainto_tsquery('english', "
    );
    qb.push_bind(q);
    qb.push(")) AS score, substring(nrc.content for 200) AS snippet FROM note_revised_current nrc JOIN note n ON n.id = nrc.note_id WHERE nrc.tsv @@ plainto_tsquery('english', ");
    qb.push_bind(q);
    qb.push(")");
    
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
        let score: Option<f32> = row.try_get::<Option<f32>, _>("score")?;
        let snippet: Option<String> = row.try_get("snippet")?;
        out.push(SearchHit { note_id, score: score.unwrap_or(0.0), snippet });
    }
    Ok(out)
}

// Helper to get a clone of AppState (for internal calls)
fn self_from_state(state: &AppState) -> AppState { state.clone() }

fn chunk_text(text: &str, max_len: usize) -> Vec<String> {
    if text.is_empty() { return vec![]; }
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
        .execute(&state.pool).await?;

    let chunks = chunk_text(content, 1500); // ~roughly ~1000 tokens depending on content
    if chunks.is_empty() { return Ok(()); }

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

pub async fn search_vector(state: &AppState, query_vec: Vec<f32>, limit: i64) -> anyhow::Result<Vec<SearchHit>> {
    // Use runtime query for pgvector type
    let rows = sqlx::query(
        r#"
        SELECT e.note_id AS note_id,
               1.0 - (e.vector <=> $1::vector) AS score
        FROM embedding e
        ORDER BY e.vector <=> $1::vector
        LIMIT $2
        "#
    )
    .bind(pgvector::Vector::from(query_vec))
    .bind(limit)
    .fetch_all(&state.pool).await?;
    
    let mut results = Vec::new();
    for row in rows {
        let note_id: Uuid = row.try_get("note_id")?;
        let score: f32 = row.try_get("score")?;
        results.push(SearchHit { note_id, score, snippet: None });
    }
    Ok(results)
}

pub async fn search_vector_filtered(state: &AppState, query_vec: Vec<f32>, filters: Option<&str>, limit: i64) -> anyhow::Result<Vec<SearchHit>> {
    let vec_param = pgvector::Vector::from(query_vec.clone());
    let mut qb = sqlx::QueryBuilder::new(
        "SELECT e.note_id AS note_id, 1.0 - (e.vector <=> "
    );
    qb.push_bind(vec_param.clone());
    qb.push("::vector) AS score FROM embedding e JOIN note n ON n.id = e.note_id WHERE TRUE");
    
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
        let score: Option<f32> = row.try_get::<Option<f32>, _>("score")?;
        out.push(SearchHit { note_id, score: score.unwrap_or(0.0), snippet: None });
    }
    Ok(out)
}

pub async fn generate_ai_revision(state: &AppState, note_id: Uuid, content: &str) -> anyhow::Result<()> {
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
        "INSERT INTO note_revision (id, note_id, created_at_utc, rationale, content, type) VALUES ($1, $2, $3, $4, $5, $6)",
        revision_id, note_id, now, "AI-enhanced revision", revised_content, "ai_enhancement"
    ).execute(&mut *tx).await?;
    
    // Update current revised content
    sqlx::query!(
        "UPDATE note_revised_current SET content = $1, last_revision_id = $2 WHERE note_id = $3",
        revised_content, revision_id, note_id
    ).execute(&mut *tx).await?;
    
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
