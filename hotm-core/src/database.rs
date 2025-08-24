//! Database operations and connection management
//! 
//! This module provides database functionality that can be shared between
//! server and unified runtime modes. Migrated from server/src/db.rs

#[cfg(feature = "database")]
pub mod db {
    use crate::models::*;
    use anyhow::Result;
    use chrono::{DateTime, Utc};
    use hex;
    use sha2::{Digest, Sha256};
    use sqlx::{Pool, Postgres, Row};
    use uuid::Uuid;

    const DEFAULT_EMBED_MODEL: &str = "nomic-embed-text";
    const DEFAULT_GEN_MODEL: &str = "gpt-oss:20b";

    #[derive(Clone)]
    pub struct DatabasePool {
        pub pool: Pool<Postgres>,
        pub embed_model: String,
        pub ollama_base: String,
        pub gen_model: String,
    }
    
    impl DatabasePool {
        pub async fn connect(database_url: &str) -> Result<Self> {
            let pool = sqlx::postgres::PgPoolOptions::new()
                .max_connections(10)
                .connect(database_url)
                .await?;
            
            // Run migrations
            sqlx::migrate!("../server/migrations").run(&pool).await?;
            
            let embed_model = std::env::var("OLLAMA_EMBED_MODEL")
                .unwrap_or_else(|_| DEFAULT_EMBED_MODEL.to_string());
            let gen_model = std::env::var("OLLAMA_GEN_MODEL")
                .unwrap_or_else(|_| DEFAULT_GEN_MODEL.to_string());
            let ollama_base = std::env::var("OLLAMA_BASE")
                .unwrap_or_else(|_| "http://127.0.0.1:11434".to_string());
            
            Ok(Self { 
                pool, 
                embed_model,
                ollama_base,
                gen_model,
            })
        }
        
        pub async fn health_check(&self) -> Result<()> {
            sqlx::query("SELECT 1").execute(&self.pool).await?;
            Ok(())
        }
    }

    // Database operations trait for testability
    #[async_trait::async_trait]
    pub trait NoteRepository: Send + Sync {
        async fn create_note(&self, content: &str, format: &str, source: &str) -> Result<Uuid>;
        async fn get_note(&self, id: Uuid) -> Result<Option<NoteFull>>;
        async fn update_revised(&self, note_id: Uuid, content: &str, rationale: Option<&str>) -> Result<Uuid>;
        async fn delete_note(&self, id: Uuid) -> Result<()>;
        async fn list_notes(&self, request: &ListNotesRequest) -> Result<ListNotesResponse>;
        async fn search_notes_fts(&self, query: &str, limit: i64) -> Result<Vec<SearchHit>>;
        async fn search_notes_semantic(&self, query_vec: Vec<f32>, limit: i64) -> Result<Vec<SearchHit>>;
        async fn update_note_status(&self, note_id: Uuid, request: &UpdateNoteStatusRequest) -> Result<()>;
        async fn update_original_content(&self, note_id: Uuid, content: &str) -> Result<()>;
    }

    // PostgreSQL implementation
    pub struct PostgresNoteRepository {
        pub pool: Pool<Postgres>,
        pub embed_model: String,
        pub gen_model: String,
    }
    
    impl PostgresNoteRepository {
        pub fn new(pool: Pool<Postgres>, embed_model: String, gen_model: String) -> Self {
            Self { pool, embed_model, gen_model }
        }
    }

    #[async_trait::async_trait]
    impl NoteRepository for PostgresNoteRepository {
        async fn create_note(&self, content: &str, format: &str, source: &str) -> Result<Uuid> {
            let note_id = Uuid::new_v4();
            let now: DateTime<Utc> = Utc::now();
            let mut tx = self.pool.begin().await?;

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
            Ok(note_id)
        }
        
        async fn get_note(&self, note_id: Uuid) -> Result<Option<NoteFull>> {
            // Update last accessed timestamp
            sqlx::query!(
                "UPDATE note SET last_accessed_at = $1 WHERE id = $2",
                Utc::now(),
                note_id
            )
            .execute(&self.pool)
            .await?;

            let note = match sqlx::query!(
                "SELECT id, collection_id, format, source, created_at_utc, updated_at_utc, starred, archived, last_accessed_at, title, metadata FROM note WHERE id = $1",
                note_id
            ).fetch_optional(&self.pool).await? {
                Some(note) => note,
                None => return Ok(None),
            };

            let original = sqlx::query!(
                "SELECT content, hash, user_created_at, user_last_edited_at FROM note_original WHERE note_id = $1",
                note_id
            ).fetch_one(&self.pool).await?;

            // Get current revised content - this table always contains the most up-to-date content
            let current = sqlx::query!(
                "SELECT nrc.content, nrc.last_revision_id, nrc.ai_metadata, nr.model 
                 FROM note_revised_current nrc
                 LEFT JOIN note_revision nr ON nr.id = nrc.last_revision_id
                 WHERE nrc.note_id = $1",
                note_id
            ).fetch_one(&self.pool).await?;

            let revised = NoteRevised {
                content: current.content,
                last_revision_id: current.last_revision_id,
                ai_metadata: current.ai_metadata,
                ai_generated_at: None,     // TODO: fetch from note_revision
                user_last_edited_at: None, // TODO: fetch from note_revision
                is_user_edited: false,     // TODO: fetch from note_revision
                generation_count: 1,       // TODO: fetch from note_revision
                model: current.model,
            };

            let tags = sqlx::query!("SELECT tag_name FROM note_tag WHERE note_id = $1", note_id)
                .fetch_all(&self.pool)
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
            .fetch_all(&self.pool)
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

            Ok(Some(NoteFull {
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
                revised,
                tags,
                links,
            }))
        }
        
        async fn update_revised(&self, note_id: Uuid, content: &str, rationale: Option<&str>) -> Result<Uuid> {
            let now = Utc::now();
            let revision_id = Uuid::new_v4();
            let mut tx = self.pool.begin().await?;

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
            Ok(revision_id)
        }
        
        async fn delete_note(&self, note_id: Uuid) -> Result<()> {
            let mut tx = self.pool.begin().await?;

            // Delete in order of dependencies
            sqlx::query!("DELETE FROM embedding WHERE note_id = $1", note_id)
                .execute(&mut *tx).await?;
            
            sqlx::query!("DELETE FROM link WHERE from_note_id = $1 OR to_note_id = $1", note_id)
                .execute(&mut *tx).await?;
                
            sqlx::query!("DELETE FROM note_tag WHERE note_id = $1", note_id)
                .execute(&mut *tx).await?;
                
            sqlx::query!("DELETE FROM note_revised_current WHERE note_id = $1", note_id)
                .execute(&mut *tx).await?;
                
            sqlx::query!("DELETE FROM note_revision WHERE note_id = $1", note_id)
                .execute(&mut *tx).await?;
                
            sqlx::query!("DELETE FROM note_original WHERE note_id = $1", note_id)
                .execute(&mut *tx).await?;
                
            sqlx::query!("DELETE FROM note WHERE id = $1", note_id)
                .execute(&mut *tx).await?;

            tx.commit().await?;
            Ok(())
        }
        
        async fn list_notes(&self, req: &ListNotesRequest) -> Result<ListNotesResponse> {
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
                _ => "", // "all" filter should show everything, including archived
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
                .fetch_one(&self.pool)
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

            let rows = sqlx::query(&notes_query).fetch_all(&self.pool).await?;

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
        
        async fn search_notes_fts(&self, q: &str, limit: i64) -> Result<Vec<SearchHit>> {
            // Use plainto_tsquery for safety
            let rows = sqlx::query!(
                r#"
                SELECT n.id as note_id,
                       ts_rank(nrc.tsv, plainto_tsquery('english', $1)) AS score,
                       substring(nrc.content for 200) AS snippet
                FROM note_revised_current nrc
                JOIN note n ON n.id = nrc.note_id
                WHERE nrc.tsv @@ plainto_tsquery('english', $1)
                  AND (n.archived IS FALSE OR n.archived IS NULL)
                ORDER BY score DESC
                LIMIT $2
                "#,
                q,
                limit
            )
            .fetch_all(&self.pool)
            .await?;

            Ok(rows
                .into_iter()
                .map(|r| SearchHit {
                    note_id: r.note_id,
                    score: r.score.unwrap_or(0.0),
                    snippet: r.snippet,
                })
                .collect())
        }
        
        async fn search_notes_semantic(&self, query_vec: Vec<f32>, limit: i64) -> Result<Vec<SearchHit>> {
            // Use runtime query for pgvector type
            let rows = sqlx::query(
                r#"
                SELECT e.note_id AS note_id,
                       1.0 - (e.vector <=> $1::vector) AS score
                FROM embedding e
                JOIN note n ON n.id = e.note_id
                WHERE (n.archived IS FALSE OR n.archived IS NULL)
                ORDER BY e.vector <=> $1::vector
                LIMIT $2
                "#,
            )
            .bind(pgvector::Vector::from(query_vec))
            .bind(limit)
            .fetch_all(&self.pool)
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
        
        async fn update_note_status(&self, note_id: Uuid, req: &UpdateNoteStatusRequest) -> Result<()> {
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

            qb.build().execute(&self.pool).await?;
            Ok(())
        }
        
        async fn update_original_content(&self, note_id: Uuid, content: &str) -> Result<()> {
            let now = Utc::now();
            
            // Calculate new hash
            let mut hasher = Sha256::new();
            hasher.update(content.as_bytes());
            let hash = format!("sha256:{}", hex::encode(hasher.finalize()));
            
            let mut tx = self.pool.begin().await?;

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
            Ok(())
        }
    }

    // Embedding operations
    #[cfg(feature = "ollama")]
    pub async fn embed_note(pool: &Pool<Postgres>, note_id: Uuid, content: &str, embed_model: &str) -> Result<()> {
        use crate::ollama::embed_texts;
        
        // delete previous embeddings for this note
        sqlx::query!("DELETE FROM embedding WHERE note_id = $1", note_id)
            .execute(pool)
            .await?;

        let chunks = chunk_text(content, 1500);
        if chunks.is_empty() {
            return Ok(());
        }

        let vectors = embed_texts(chunks.clone(), embed_model).await?;

        let mut tx = pool.begin().await?;
        for (i, vec) in vectors.into_iter().enumerate() {
            sqlx::query(
                "INSERT INTO embedding (id, note_id, chunk_index, text, vector, model) VALUES ($1, $2, $3, $4, $5, $6)"
            )
            .bind(Uuid::new_v4())
            .bind(note_id)
            .bind(i as i32)
            .bind(&chunks[i])
            .bind(pgvector::Vector::from(vec))
            .bind(embed_model)
            .execute(&mut *tx).await?;
        }
        tx.commit().await?;
        Ok(())
    }

    // Helper function to chunk text
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

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn test_chunk_text() {
            let text = "This is a test text that should be chunked properly";
            let chunks = chunk_text(text, 20);
            
            assert!(!chunks.is_empty());
            for chunk in chunks {
                assert!(chunk.len() <= 20);
            }
        }

        #[test]
        fn test_chunk_text_empty() {
            let chunks = chunk_text("", 100);
            assert!(chunks.is_empty());
        }
    }
}