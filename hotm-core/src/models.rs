//! Core data models for HotM
//! 
//! These models are shared across all HotM applications (server, desktop, unified).
//! Migrated from server/src/models.rs to provide comprehensive data model coverage.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use uuid::Uuid;

// Core Note Models
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct NoteMeta {
    pub id: Uuid,
    pub collection_id: Option<Uuid>,
    pub format: String,
    pub source: String,
    pub created_at_utc: DateTime<Utc>,
    pub updated_at_utc: DateTime<Utc>,
    pub starred: bool,
    pub archived: bool,
    pub last_accessed_at: Option<DateTime<Utc>>,
    pub title: Option<String>,
    pub metadata: JsonValue,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct NoteOriginal {
    pub content: String,
    pub hash: String,
    pub user_created_at: Option<DateTime<Utc>>,
    pub user_last_edited_at: Option<DateTime<Utc>>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct NoteRevised {
    pub content: String,
    pub last_revision_id: Option<Uuid>,
    pub ai_metadata: Option<JsonValue>,
    pub ai_generated_at: Option<DateTime<Utc>>,
    pub user_last_edited_at: Option<DateTime<Utc>>,
    pub is_user_edited: bool,
    pub generation_count: i32,
    pub model: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Link {
    pub id: Uuid,
    pub from_note_id: Uuid,
    pub to_note_id: Option<Uuid>,
    pub to_url: Option<String>,
    pub kind: String,
    pub score: f32,
    pub created_at_utc: DateTime<Utc>,
    pub snippet: Option<String>,
    pub metadata: Option<JsonValue>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct NoteFull {
    pub note: NoteMeta,
    pub original: NoteOriginal,
    pub revised: NoteRevised,
    pub tags: Vec<String>,
    pub links: Vec<Link>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Collection {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub created_at_utc: DateTime<Utc>,
    pub updated_at_utc: DateTime<Utc>,
    pub metadata: JsonValue,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Tag {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub color: Option<String>,
    pub created_at_utc: DateTime<Utc>,
}

// API Request/Response Models
#[derive(Serialize, Deserialize, Debug)]
pub struct CreateNoteRequest {
    pub content: String,
    pub format: Option<String>,
    pub source: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct CreateNoteResponse {
    pub note_id: Uuid,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct PutRevisedRequest {
    pub content: String,
    pub rationale: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct PutRevisedResponse {
    pub revision_id: Uuid,
    pub revised_content: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SearchHit {
    pub note_id: Uuid,
    pub score: f32,
    pub snippet: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SearchResponse {
    pub notes: Vec<SearchHit>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SemanticRequest {
    pub text: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SemanticResponse {
    pub similar: Vec<SearchHit>,
}

// Tag Management
#[derive(Serialize, Deserialize, Debug)]
pub struct PutNoteTagsRequest {
    pub add: Option<Vec<String>>,
    pub remove: Option<Vec<String>>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct PutNoteTagsResponse {
    pub tags: Vec<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct CreateTagRequest {
    pub name: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct CreateTagResponse {
    pub name: String,
}

// Collection Management
#[derive(Serialize, Deserialize, Debug)]
pub struct CreateCollectionRequest {
    pub name: String,
    pub description: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct CreateCollectionResponse {
    pub collection_id: Uuid,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct PutNoteCollectionRequest {
    pub collection_id: Uuid,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct PutNoteCollectionResponse {
    pub collection_id: Uuid,
}

// Link Management
#[derive(Serialize, Deserialize, Debug)]
pub struct PostLinkRequest {
    pub to_note_id: Option<Uuid>,
    pub to_url: Option<String>,
    pub kind: String,
    pub score: Option<f32>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct PostLinkResponse {
    pub link_id: Uuid,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct CreateLinkRequest {
    pub to_note_id: Uuid,
    pub reason: Option<String>,
}

// Note Management
#[derive(Serialize, Deserialize, Debug)]
pub struct UpdateNoteTitleRequest {
    pub title: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct UpdateOriginalContentRequest {
    pub content: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ListNotesRequest {
    pub sort_by: Option<String>,    // created_at, updated_at, accessed_at
    pub sort_order: Option<String>, // asc, desc
    pub filter: Option<String>,     // all, starred, archived, recent
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct NoteSummary {
    pub id: Uuid,
    pub title: String,
    pub snippet: String,
    pub created_at_utc: DateTime<Utc>,
    pub updated_at_utc: DateTime<Utc>,
    pub starred: bool,
    pub archived: bool,
    pub tags: Vec<String>,
    pub has_revision: bool,
    pub metadata: JsonValue,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ListNotesResponse {
    pub notes: Vec<NoteSummary>,
    pub total: i64,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct UpdateNoteStatusRequest {
    pub starred: Option<bool>,
    pub archived: Option<bool>,
}

// User Metadata and Configuration
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UserMetadataLabel {
    pub id: Uuid,
    pub note_id: Uuid,
    pub label: String,
    pub color: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct AddMetadataLabelRequest {
    pub label: String,
    pub color: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct UserConfig {
    pub key: String,
    pub value: JsonValue,
    pub updated_at: DateTime<Utc>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct UpdateConfigRequest {
    pub key: String,
    pub value: JsonValue,
}

// Provenance Models
#[derive(Serialize, Deserialize, Debug)]
pub struct ProvenanceEdge {
    pub id: Uuid,
    pub revision_id: Uuid,
    pub source_note_id: Option<Uuid>,
    pub source_url: Option<String>,
    pub relation: String,
    pub created_at_utc: DateTime<Utc>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct RevisionNode {
    pub id: Uuid,
    pub parent_revision_id: Option<Uuid>,
    pub created_at_utc: DateTime<Utc>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ProvenanceResponse {
    pub revisions: Vec<RevisionNode>,
    pub edges: Vec<ProvenanceEdge>,
}

// Job Queue Models (migrated from server)
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Job {
    pub id: Uuid,
    pub note_id: Option<Uuid>,
    pub job_type: String,
    pub status: String,
    pub priority: i32,
    pub created_at_utc: DateTime<Utc>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub error_message: Option<String>,
    pub retry_count: i32,
    pub metadata: Option<JsonValue>,
    pub progress_message: Option<String>,
}

// Configuration models
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AppConfig {
    pub database_url: String,
    pub ollama_base_url: String,
    pub embed_model: String,
    pub generation_model: String,
    pub bind_address: String,
    pub bind_port: u16,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            database_url: "postgres://hotm:hotm@localhost:5432/hotm_dev".to_string(),
            ollama_base_url: "http://localhost:11434".to_string(),
            embed_model: "nomic-embed-text".to_string(),
            generation_model: "gpt-oss:20b".to_string(),
            bind_address: "127.0.0.1".to_string(),
            bind_port: 53211,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_note_meta_serialization() {
        let note = NoteMeta {
            id: Uuid::new_v4(),
            collection_id: None,
            format: "markdown".to_string(),
            source: "test".to_string(),
            created_at_utc: Utc::now(),
            updated_at_utc: Utc::now(),
            starred: false,
            archived: false,
            last_accessed_at: None,
            title: None,
            metadata: json!({}),
        };

        let serialized = serde_json::to_string(&note).unwrap();
        let deserialized: NoteMeta = serde_json::from_str(&serialized).unwrap();

        assert_eq!(note.id, deserialized.id);
        assert_eq!(note.format, deserialized.format);
        assert_eq!(note.source, deserialized.source);
        assert_eq!(note.starred, deserialized.starred);
    }

    #[test]
    fn test_create_note_request_validation() {
        let valid_request = CreateNoteRequest {
            content: "Test content".to_string(),
            format: Some("markdown".to_string()),
            source: Some("test".to_string()),
        };

        assert!(!valid_request.content.is_empty());
        assert_eq!(valid_request.format, Some("markdown".to_string()));

        let minimal_request = CreateNoteRequest {
            content: "Test".to_string(),
            format: None,
            source: None,
        };

        assert!(!minimal_request.content.is_empty());
        assert!(minimal_request.format.is_none());
    }

    #[test]
    fn test_link_metadata_handling() {
        let link = Link {
            id: Uuid::new_v4(),
            from_note_id: Uuid::new_v4(),
            to_note_id: Some(Uuid::new_v4()),
            to_url: None,
            kind: "keyword".to_string(),
            score: 0.85,
            created_at_utc: Utc::now(),
            snippet: Some("Test snippet".to_string()),
            metadata: Some(json!({
                "keywords": ["rust", "async"]
            })),
        };

        assert_eq!(link.kind, "keyword");
        assert!(link.metadata.is_some());

        let metadata = link.metadata.unwrap();
        assert!(metadata["keywords"].is_array());

        let keywords = metadata["keywords"].as_array().unwrap();
        assert_eq!(keywords.len(), 2);
    }

    #[test]
    fn test_search_hit_score_validation() {
        let hit = SearchHit {
            note_id: Uuid::new_v4(),
            score: 0.95,
            snippet: Some("Matching content...".to_string()),
        };

        assert!(hit.score >= 0.0 && hit.score <= 1.0);
        assert!(hit.snippet.is_some());
    }

    #[test]
    fn test_note_revised_ai_metadata() {
        let revised = NoteRevised {
            content: "Revised content".to_string(),
            last_revision_id: Some(Uuid::new_v4()),
            ai_metadata: Some(json!({
                "categories": ["Technology"],
                "topics": ["Rust", "Programming"],
                "keywords": ["async", "tokio"],
                "entities": {
                    "technologies": ["Rust", "Tokio"]
                }
            })),
            ai_generated_at: Some(Utc::now()),
            user_last_edited_at: None,
            is_user_edited: false,
            generation_count: 1,
            model: Some("gpt-oss:20b".to_string()),
        };

        assert!(revised.ai_metadata.is_some());

        let metadata = revised.ai_metadata.unwrap();
        assert!(metadata["categories"].is_array());
        assert!(metadata["topics"].is_array());
        assert!(metadata["keywords"].is_array());
        assert!(metadata["entities"]["technologies"].is_array());
    }
}