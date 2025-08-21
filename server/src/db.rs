use sqlx::{Pool, Postgres};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use crate::models::*;

#[derive(Clone)]
pub struct AppState {
    pub pool: Pool<Postgres>,
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
        Ok(Self { pool })
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

    let hash = format!("sha256:{:x}", sha256::digest(content));

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
