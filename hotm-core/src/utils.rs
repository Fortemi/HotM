//! Utility functions and trait abstractions shared across HotM applications

#[allow(unused_imports)]
use anyhow::Result;
use regex::Regex;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use uuid::Uuid;

// Re-export commonly used traits
#[cfg(feature = "database")]
pub use crate::database::db::NoteRepository;

#[cfg(feature = "ollama")]
pub use crate::ollama::client::AIService;

#[cfg(feature = "websocket")]
pub use crate::websocket::broadcaster::EventBus;

#[cfg(feature = "database")]
pub use crate::job_queue::queue::{JobQueue, JobProcessor};

/// Generate SHA-256 hash of content for note deduplication and integrity
pub fn generate_content_hash(content: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(content.as_bytes());
    format!("sha256:{}", hex::encode(hasher.finalize()))
}

/// Normalize text for consistent processing
pub fn normalize_text(text: &str) -> String {
    text.trim()
        .lines()
        .map(|line| line.trim())
        .collect::<Vec<_>>()
        .join("\n")
        .trim()
        .to_string()
}

/// Extract title from markdown content
pub fn extract_title_from_content(content: &str) -> Option<String> {
    let lines: Vec<&str> = content.lines().collect();
    
    for line in lines {
        let trimmed = line.trim();
        if let Some(stripped) = trimmed.strip_prefix("# ") {
            return Some(stripped.trim().to_string());
        }
    }
    
    None
}

/// Extract first meaningful line as title fallback
pub fn extract_first_line_as_title(content: &str, max_length: usize) -> String {
    content
        .lines()
        .find(|line| !line.trim().is_empty())
        .map(|line| {
            let clean_line = line.trim_start_matches('#').trim();
            if clean_line.len() > max_length {
                format!("{}...", &clean_line[..max_length.saturating_sub(3)])
            } else {
                clean_line.to_string()
            }
        })
        .unwrap_or_else(|| "Untitled".to_string())
}

/// Truncate text to specified length with ellipsis
pub fn truncate_text(text: &str, max_length: usize) -> String {
    if text.len() <= max_length {
        text.to_string()
    } else {
        format!("{}...", &text[..max_length.saturating_sub(3)])
    }
}

/// Generate snippet from content around search terms
pub fn generate_snippet(content: &str, query: &str, max_length: usize) -> String {
    if query.is_empty() {
        return truncate_text(content, max_length);
    }
    
    let normalized_content = content.to_lowercase();
    let normalized_query = query.to_lowercase();
    
    if let Some(pos) = normalized_content.find(&normalized_query) {
        let start = pos.saturating_sub(max_length / 3);
        let end = (pos + query.len() + max_length / 3).min(content.len());
        
        let mut snippet = content[start..end].to_string();
        if start > 0 {
            snippet = format!("...{}", snippet);
        }
        if end < content.len() {
            snippet = format!("{}...", snippet);
        }
        
        snippet
    } else {
        truncate_text(content, max_length)
    }
}

/// Chunk text for processing (e.g., embeddings)
pub fn chunk_text(text: &str, max_len: usize) -> Vec<String> {
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

/// Extract keywords from text using simple heuristics
pub fn extract_keywords(text: &str, min_length: usize, max_keywords: usize) -> Vec<String> {
    let stop_words = get_stop_words();
    let word_regex = Regex::new(r"\b[a-zA-Z]{2,}\b").unwrap();
    
    let mut word_counts: HashMap<String, usize> = HashMap::new();
    
    for mat in word_regex.find_iter(text) {
        let word = mat.as_str().to_lowercase();
        if word.len() >= min_length && !stop_words.contains(&word.as_str()) {
            *word_counts.entry(word).or_insert(0) += 1;
        }
    }
    
    let mut keywords: Vec<_> = word_counts.into_iter().collect();
    keywords.sort_by(|a, b| b.1.cmp(&a.1));
    
    keywords
        .into_iter()
        .take(max_keywords)
        .map(|(word, _)| word)
        .collect()
}

/// Get common English stop words
fn get_stop_words() -> &'static [&'static str] {
    &[
        "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with",
        "by", "from", "up", "about", "into", "through", "during", "before", "after", "above",
        "below", "between", "among", "throughout", "despite", "towards", "upon", "concerning",
        "i", "you", "he", "she", "it", "we", "they", "me", "him", "her", "us", "them",
        "my", "your", "his", "her", "its", "our", "their", "this", "that", "these", "those",
        "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does",
        "did", "will", "would", "could", "should", "may", "might", "must", "can", "cannot",
        "what", "which", "who", "whom", "whose", "where", "when", "why", "how",
    ]
}

/// Validate UUID strings
pub fn is_valid_uuid(uuid_str: &str) -> bool {
    Uuid::parse_str(uuid_str).is_ok()
}

/// Format file size in human readable format
pub fn format_file_size(bytes: u64) -> String {
    const UNITS: &[&str] = &["B", "KB", "MB", "GB", "TB"];
    let mut size = bytes as f64;
    let mut unit_index = 0;
    
    while size >= 1024.0 && unit_index < UNITS.len() - 1 {
        size /= 1024.0;
        unit_index += 1;
    }
    
    if unit_index == 0 {
        format!("{} {}", bytes, UNITS[unit_index])
    } else {
        format!("{:.1} {}", size, UNITS[unit_index])
    }
}

/// Mock implementations for testing
#[cfg(test)]
pub mod mocks {
    use super::*;
    use crate::models::*;
    use async_trait::async_trait;
    use std::collections::HashMap;
    use std::sync::{Arc, Mutex};

    #[cfg(feature = "database")]
    pub struct MockNoteRepository {
        notes: Arc<Mutex<HashMap<Uuid, NoteFull>>>,
    }

    #[cfg(feature = "database")]
    impl MockNoteRepository {
        pub fn new() -> Self {
            Self {
                notes: Arc::new(Mutex::new(HashMap::new())),
            }
        }
    }

    #[cfg(feature = "database")]
    #[async_trait]
    impl NoteRepository for MockNoteRepository {
        async fn create_note(&self, content: &str, format: &str, source: &str) -> Result<Uuid> {
            let note_id = Uuid::new_v4();
            let now = chrono::Utc::now();
            
            let note_full = NoteFull {
                note: NoteMeta {
                    id: note_id,
                    collection_id: None,
                    format: format.to_string(),
                    source: source.to_string(),
                    created_at_utc: now,
                    updated_at_utc: now,
                    starred: false,
                    archived: false,
                    last_accessed_at: None,
                    title: extract_title_from_content(content),
                    metadata: serde_json::json!({}),
                },
                original: NoteOriginal {
                    content: content.to_string(),
                    hash: generate_content_hash(content),
                    user_created_at: None,
                    user_last_edited_at: None,
                },
                revised: NoteRevised {
                    content: content.to_string(),
                    last_revision_id: None,
                    ai_metadata: None,
                    ai_generated_at: None,
                    user_last_edited_at: None,
                    is_user_edited: false,
                    generation_count: 0,
                    model: None,
                },
                tags: vec![],
                links: vec![],
            };
            
            self.notes.lock().unwrap().insert(note_id, note_full);
            Ok(note_id)
        }
        
        async fn get_note(&self, id: Uuid) -> Result<Option<NoteFull>> {
            Ok(self.notes.lock().unwrap().get(&id).cloned())
        }
        
        async fn update_revised(&self, note_id: Uuid, content: &str, _rationale: Option<&str>) -> Result<Uuid> {
            let revision_id = Uuid::new_v4();
            if let Some(note) = self.notes.lock().unwrap().get_mut(&note_id) {
                note.revised.content = content.to_string();
                note.revised.last_revision_id = Some(revision_id);
            }
            Ok(revision_id)
        }
        
        async fn delete_note(&self, id: Uuid) -> Result<()> {
            self.notes.lock().unwrap().remove(&id);
            Ok(())
        }
        
        async fn list_notes(&self, _request: &ListNotesRequest) -> Result<ListNotesResponse> {
            let notes = self.notes.lock().unwrap();
            let summaries: Vec<NoteSummary> = notes
                .values()
                .map(|note| NoteSummary {
                    id: note.note.id,
                    title: note.note.title.clone().unwrap_or_else(|| "Untitled".to_string()),
                    snippet: truncate_text(&note.revised.content, 200),
                    created_at_utc: note.note.created_at_utc,
                    updated_at_utc: note.note.updated_at_utc,
                    starred: note.note.starred,
                    archived: note.note.archived,
                    tags: note.tags.clone(),
                    has_revision: !note.revised.content.is_empty(),
                    metadata: note.note.metadata.clone(),
                })
                .collect();
            
            Ok(ListNotesResponse {
                notes: summaries.clone(),
                total: summaries.len() as i64,
            })
        }
        
        async fn search_notes_fts(&self, query: &str, limit: i64) -> Result<Vec<SearchHit>> {
            let notes = self.notes.lock().unwrap();
            let mut results: Vec<SearchHit> = notes
                .values()
                .filter(|note| {
                    note.revised.content.to_lowercase().contains(&query.to_lowercase())
                })
                .map(|note| SearchHit {
                    note_id: note.note.id,
                    score: 0.8, // Mock score
                    snippet: Some(generate_snippet(&note.revised.content, query, 200)),
                })
                .take(limit as usize)
                .collect();
            
            results.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap());
            Ok(results)
        }
        
        async fn search_notes_semantic(&self, _query_vec: Vec<f32>, limit: i64) -> Result<Vec<SearchHit>> {
            let notes = self.notes.lock().unwrap();
            let results: Vec<SearchHit> = notes
                .values()
                .take(limit as usize)
                .map(|note| SearchHit {
                    note_id: note.note.id,
                    score: 0.7, // Mock score
                    snippet: Some(truncate_text(&note.revised.content, 200)),
                })
                .collect();
            
            Ok(results)
        }
        
        async fn update_note_status(&self, note_id: Uuid, request: &UpdateNoteStatusRequest) -> Result<()> {
            if let Some(note) = self.notes.lock().unwrap().get_mut(&note_id) {
                if let Some(starred) = request.starred {
                    note.note.starred = starred;
                }
                if let Some(archived) = request.archived {
                    note.note.archived = archived;
                }
            }
            Ok(())
        }
        
        async fn update_original_content(&self, note_id: Uuid, content: &str) -> Result<()> {
            if let Some(note) = self.notes.lock().unwrap().get_mut(&note_id) {
                note.original.content = content.to_string();
                note.original.hash = generate_content_hash(content);
            }
            Ok(())
        }
    }

    #[cfg(feature = "ollama")]
    pub struct MockAIService {
        should_fail: bool,
    }

    #[cfg(feature = "ollama")]
    impl MockAIService {
        pub fn new() -> Self {
            Self { should_fail: false }
        }
        
        pub fn new_with_failure() -> Self {
            Self { should_fail: true }
        }
    }

    #[cfg(feature = "ollama")]
    #[async_trait]
    impl super::AIService for MockAIService {
        async fn embed_texts(&self, texts: Vec<String>, _model: &str) -> Result<Vec<Vec<f32>>> {
            if self.should_fail {
                return Err(anyhow::anyhow!("Mock embedding failure"));
            }
            
            Ok(texts.into_iter().map(|_| vec![0.1, 0.2, 0.3, 0.4, 0.5]).collect())
        }
        
        async fn generate_text(&self, prompt: &str, _model: &str) -> Result<String> {
            if self.should_fail {
                return Err(anyhow::anyhow!("Mock generation failure"));
            }
            
            Ok(format!("Generated response for: {}", prompt))
        }
        
        async fn health_check(&self) -> Result<()> {
            if self.should_fail {
                Err(anyhow::anyhow!("Mock health check failure"))
            } else {
                Ok(())
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_content_hash() {
        let content = "Hello, world!";
        let hash = generate_content_hash(content);
        assert_eq!(hash.len(), 71); // SHA-256 produces 64 hex characters + "sha256:" prefix
        
        // Same content should produce same hash
        assert_eq!(hash, generate_content_hash(content));
        
        // Different content should produce different hash
        assert_ne!(hash, generate_content_hash("Different content"));
    }

    #[test]
    fn test_normalize_text() {
        let input = "  Line 1  \n  Line 2  \n  ";
        let expected = "Line 1\nLine 2";
        assert_eq!(normalize_text(input), expected);
    }

    #[test]
    fn test_extract_title_from_content() {
        let content_with_title = "# My Title\n\nSome content here";
        assert_eq!(extract_title_from_content(content_with_title), Some("My Title".to_string()));
        
        let content_without_title = "Just some content\nwithout a title";
        assert_eq!(extract_title_from_content(content_without_title), None);
    }

    #[test]
    fn test_truncate_text() {
        let text = "This is a long text that should be truncated";
        let truncated = truncate_text(text, 20);
        assert_eq!(truncated, "This is a long te...");
        
        let short_text = "Short";
        let not_truncated = truncate_text(short_text, 20);
        assert_eq!(not_truncated, "Short");
    }

    #[test]
    fn test_generate_snippet() {
        let content = "This is some content with important information in the middle";
        let query = "important";
        let snippet = generate_snippet(content, query, 30);
        
        assert!(snippet.contains("important"));
        // Generated snippet may be longer due to context around the query
    }
}