use sqlx::{Pool, Postgres};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use crate::models::*;
use sha2::{Sha256, Digest};
use hex;

const DEFAULT_EMBED_MODEL: &str = "nomic-embed-text";

#[derive(Clone)]
pub struct AppState {
    pub pool: Pool<Postgres>,
    pub embed_model: String,
    pub ollama_base: String,
}

impl AppState {
    pub async fn connect(url: &str) -> anyhow::Result<Self> {
        let pool = sqlx::postgres::PgPoolOptions::new()
            .max_connections(10)
            .connect(url)
            .await?;
        // Optionally run migrations if present
        if std::path::Path::new("server/migrations").exists() {
            sqlx::migrate!("server/migrations").run(&pool).await?;
        }
        let embed_model = std::env::var("OLLAMA_EMBED_MODEL").unwrap_or_else(|_| DEFAULT_EMBED_MODEL.to_string());
        let ollama_base = std::env::var("OLLAMA_BASE").unwrap_or_else(|_| "http://127.0.0.1:11434".to_string());
        Ok(Self { pool, embed_model, ollama_base })
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

    // Compute and store embeddings for the revised content
    embed_note(&self_from_state(state), note_id, content).await?;
    Ok(note_id)
}

pub async fn fetch_note(state: &AppState, note_id: Uuid) -> anyhow::Result<NoteFull> {
    let note = sqlx::query!(
        "SELECT id, collection_id, format, source, created_at_utc, updated_at_utc FROM note WHERE id = $1",
        note_id
    ).fetch_one(&state.pool).await?;

    let original = sqlx::query!(
        "SELECT content, hash FROM note_original WHERE note_id = $1",
        note_id
    ).fetch_one(&state.pool).await?;

    let revised = sqlx::query!(
        "SELECT content, last_revision_id FROM note_revised_current WHERE note_id = $1",
        note_id
    ).fetch_one(&state.pool).await?;

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
        },
        original: NoteOriginal { content: original.content, hash: original.hash },
        revised: NoteRevised { content: revised.content, last_revision_id: revised.last_revision_id },
        tags,
        links,
    })
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

    // Re-embed current content
    embed_note(&self_from_state(state), note_id, content).await?;
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
        sqlx::query!(
            "INSERT INTO embedding (id, note_id, chunk_index, text, vector, model) VALUES ($1, $2, $3, $4, $5, $6)",
            Uuid::new_v4(), note_id, i as i32, chunks[i], pgvector::Vector::from(vec), state.embed_model
        ).execute(&mut *tx).await?;
    }
    tx.commit().await?;
    Ok(())
}

pub async fn search_vector(state: &AppState, query_vec: Vec<f32>, limit: i64) -> anyhow::Result<Vec<SearchHit>> {
    let rows = sqlx::query!(
        r#"
        SELECT e.note_id AS note_id,
               1.0 - (e.vector <=> $1::vector) AS score
        FROM embedding e
        ORDER BY e.vector <=> $1::vector
        LIMIT $2
        "#,
        pgvector::Vector::from(query_vec),
        limit
    ).fetch_all(&state.pool).await?;
    Ok(rows.into_iter().map(|r| SearchHit { note_id: r.note_id, score: r.score.unwrap_or(0.0) as f32, snippet: None }).collect())
}
