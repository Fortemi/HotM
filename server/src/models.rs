use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use uuid::Uuid;

#[derive(Serialize, Deserialize, Clone)]
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

#[derive(Serialize, Deserialize, Clone)]
pub struct NoteOriginal {
    pub content: String,
    pub hash: String,
    pub user_created_at: Option<DateTime<Utc>>,
    pub user_last_edited_at: Option<DateTime<Utc>>,
}

#[derive(Serialize, Deserialize, Clone)]
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

#[derive(Serialize, Deserialize, Clone)]
pub struct Link {
    pub id: Uuid,
    pub from_note_id: Uuid,
    pub to_note_id: Option<Uuid>,
    pub to_url: Option<String>,
    pub kind: String,
    pub score: f32,
    pub created_at_utc: DateTime<Utc>,
    pub snippet: Option<String>,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct NoteFull {
    pub note: NoteMeta,
    pub original: NoteOriginal,
    pub revised: NoteRevised,
    pub tags: Vec<String>,
    pub links: Vec<Link>,
}

#[derive(Serialize, Deserialize)]
pub struct CreateNoteRequest {
    pub content: String,
    pub format: Option<String>,
    pub source: Option<String>,
}
#[derive(Serialize, Deserialize)]
pub struct CreateNoteResponse {
    pub note_id: Uuid,
}

#[derive(Serialize, Deserialize)]
pub struct PutRevisedRequest {
    pub content: String,
    pub rationale: Option<String>,
}
#[derive(Serialize, Deserialize)]
pub struct PutRevisedResponse {
    pub revision_id: Uuid,
    pub revised_content: String,
}

#[derive(Serialize, Deserialize)]
pub struct SearchResponse {
    pub notes: Vec<SearchHit>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct SearchHit {
    pub note_id: Uuid,
    pub score: f32,
    pub snippet: Option<String>,
}

// Tags
#[derive(Serialize, Deserialize)]
pub struct PutNoteTagsRequest {
    pub add: Option<Vec<String>>,
    pub remove: Option<Vec<String>>,
}
#[derive(Serialize, Deserialize)]
pub struct PutNoteTagsResponse {
    pub tags: Vec<String>,
}

#[derive(Serialize, Deserialize)]
pub struct CreateTagRequest {
    pub name: String,
}
#[derive(Serialize, Deserialize)]
pub struct CreateTagResponse {
    pub name: String,
}

// Collections
#[derive(Serialize, Deserialize)]
pub struct CreateCollectionRequest {
    pub name: String,
    pub description: Option<String>,
}
#[derive(Serialize, Deserialize)]
pub struct CreateCollectionResponse {
    pub collection_id: Uuid,
}
#[derive(Serialize, Deserialize)]
pub struct PutNoteCollectionRequest {
    pub collection_id: Uuid,
}
#[derive(Serialize, Deserialize)]
pub struct PutNoteCollectionResponse {
    pub collection_id: Uuid,
}

// Links
#[derive(Serialize, Deserialize)]
pub struct PostLinkRequest {
    pub to_note_id: Option<Uuid>,
    pub to_url: Option<String>,
    pub kind: String,
    pub score: Option<f32>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    // =============================================================================
    // NOTEMETA TESTS
    // =============================================================================

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
    fn test_note_meta_with_all_fields() {
        let now = Utc::now();
        let note = NoteMeta {
            id: Uuid::new_v4(),
            collection_id: Some(Uuid::new_v4()),
            format: "html".to_string(),
            source: "import".to_string(),
            created_at_utc: now,
            updated_at_utc: now,
            starred: true,
            archived: true,
            last_accessed_at: Some(now),
            title: Some("Test Title".to_string()),
            metadata: json!({"custom": "data"}),
        };

        let json = serde_json::to_string(&note).unwrap();
        let parsed: NoteMeta = serde_json::from_str(&json).unwrap();

        assert!(parsed.collection_id.is_some());
        assert!(parsed.starred);
        assert!(parsed.archived);
        assert!(parsed.last_accessed_at.is_some());
        assert_eq!(parsed.title, Some("Test Title".to_string()));
        assert_eq!(parsed.metadata["custom"], "data");
    }

    #[test]
    fn test_note_meta_clone() {
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

        let cloned = note.clone();
        assert_eq!(note.id, cloned.id);
        assert_eq!(note.format, cloned.format);
    }

    // =============================================================================
    // NOTEORIGINAL TESTS
    // =============================================================================

    #[test]
    fn test_note_original_serialization() {
        let original = NoteOriginal {
            content: "Original content".to_string(),
            hash: "sha256:abc123".to_string(),
            user_created_at: Some(Utc::now()),
            user_last_edited_at: None,
        };

        let json = serde_json::to_string(&original).unwrap();
        let parsed: NoteOriginal = serde_json::from_str(&json).unwrap();

        assert_eq!(parsed.content, "Original content");
        assert_eq!(parsed.hash, "sha256:abc123");
        assert!(parsed.user_created_at.is_some());
        assert!(parsed.user_last_edited_at.is_none());
    }

    #[test]
    fn test_note_original_clone() {
        let original = NoteOriginal {
            content: "Test".to_string(),
            hash: "sha256:test".to_string(),
            user_created_at: None,
            user_last_edited_at: None,
        };

        let cloned = original.clone();
        assert_eq!(original.content, cloned.content);
        assert_eq!(original.hash, cloned.hash);
    }

    // =============================================================================
    // NOTEREVISED TESTS
    // =============================================================================

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

    #[test]
    fn test_note_revised_user_edited() {
        let revised = NoteRevised {
            content: "User edited content".to_string(),
            last_revision_id: Some(Uuid::new_v4()),
            ai_metadata: None,
            ai_generated_at: None,
            user_last_edited_at: Some(Utc::now()),
            is_user_edited: true,
            generation_count: 0,
            model: None,
        };

        assert!(revised.is_user_edited);
        assert!(revised.user_last_edited_at.is_some());
        assert!(revised.ai_metadata.is_none());
        assert_eq!(revised.generation_count, 0);
    }

    #[test]
    fn test_note_revised_clone() {
        let revised = NoteRevised {
            content: "Test".to_string(),
            last_revision_id: None,
            ai_metadata: None,
            ai_generated_at: None,
            user_last_edited_at: None,
            is_user_edited: false,
            generation_count: 0,
            model: None,
        };

        let cloned = revised.clone();
        assert_eq!(revised.content, cloned.content);
        assert_eq!(revised.is_user_edited, cloned.is_user_edited);
    }

    // =============================================================================
    // LINK TESTS
    // =============================================================================

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
    fn test_link_to_url() {
        let link = Link {
            id: Uuid::new_v4(),
            from_note_id: Uuid::new_v4(),
            to_note_id: None,
            to_url: Some("https://example.com".to_string()),
            kind: "external".to_string(),
            score: 1.0,
            created_at_utc: Utc::now(),
            snippet: None,
            metadata: None,
        };

        assert!(link.to_note_id.is_none());
        assert_eq!(link.to_url, Some("https://example.com".to_string()));
        assert_eq!(link.kind, "external");
    }

    #[test]
    fn test_link_clone() {
        let link = Link {
            id: Uuid::new_v4(),
            from_note_id: Uuid::new_v4(),
            to_note_id: Some(Uuid::new_v4()),
            to_url: None,
            kind: "related".to_string(),
            score: 0.9,
            created_at_utc: Utc::now(),
            snippet: None,
            metadata: None,
        };

        let cloned = link.clone();
        assert_eq!(link.id, cloned.id);
        assert_eq!(link.score, cloned.score);
    }

    // =============================================================================
    // NOTEFULL TESTS
    // =============================================================================

    #[test]
    fn test_note_full_structure() {
        let note_full = NoteFull {
            note: NoteMeta {
                id: Uuid::new_v4(),
                collection_id: None,
                format: "markdown".to_string(),
                source: "test".to_string(),
                created_at_utc: Utc::now(),
                updated_at_utc: Utc::now(),
                starred: false,
                archived: false,
                last_accessed_at: None,
                title: Some("Test Note".to_string()),
                metadata: json!({}),
            },
            original: NoteOriginal {
                content: "Original".to_string(),
                hash: "sha256:test".to_string(),
                user_created_at: None,
                user_last_edited_at: None,
            },
            revised: NoteRevised {
                content: "Revised".to_string(),
                last_revision_id: None,
                ai_metadata: None,
                ai_generated_at: None,
                user_last_edited_at: None,
                is_user_edited: false,
                generation_count: 0,
                model: None,
            },
            tags: vec!["rust".to_string(), "test".to_string()],
            links: vec![],
        };

        let json = serde_json::to_string(&note_full).unwrap();
        let parsed: NoteFull = serde_json::from_str(&json).unwrap();

        assert_eq!(parsed.note.title, Some("Test Note".to_string()));
        assert_eq!(parsed.original.content, "Original");
        assert_eq!(parsed.revised.content, "Revised");
        assert_eq!(parsed.tags.len(), 2);
        assert!(parsed.links.is_empty());
    }

    // =============================================================================
    // REQUEST/RESPONSE TESTS
    // =============================================================================

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
    fn test_create_note_response() {
        let response = CreateNoteResponse {
            note_id: Uuid::new_v4(),
        };

        let json = serde_json::to_string(&response).unwrap();
        let parsed: CreateNoteResponse = serde_json::from_str(&json).unwrap();

        assert_eq!(response.note_id, parsed.note_id);
    }

    #[test]
    fn test_put_revised_request() {
        let request = PutRevisedRequest {
            content: "New revised content".to_string(),
            rationale: Some("User edit".to_string()),
        };

        let json = serde_json::to_string(&request).unwrap();
        let parsed: PutRevisedRequest = serde_json::from_str(&json).unwrap();

        assert_eq!(parsed.content, "New revised content");
        assert_eq!(parsed.rationale, Some("User edit".to_string()));
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
    fn test_search_response() {
        let response = SearchResponse {
            notes: vec![
                SearchHit {
                    note_id: Uuid::new_v4(),
                    score: 0.9,
                    snippet: Some("Match 1".to_string()),
                },
                SearchHit {
                    note_id: Uuid::new_v4(),
                    score: 0.8,
                    snippet: Some("Match 2".to_string()),
                },
            ],
        };

        let json = serde_json::to_string(&response).unwrap();
        let parsed: SearchResponse = serde_json::from_str(&json).unwrap();

        assert_eq!(parsed.notes.len(), 2);
        assert!(parsed.notes[0].score > parsed.notes[1].score);
    }

    // =============================================================================
    // TAG TESTS
    // =============================================================================

    #[test]
    fn test_put_note_tags_request() {
        let request = PutNoteTagsRequest {
            add: Some(vec!["new-tag".to_string()]),
            remove: Some(vec!["old-tag".to_string()]),
        };

        let json = serde_json::to_string(&request).unwrap();
        let parsed: PutNoteTagsRequest = serde_json::from_str(&json).unwrap();

        assert_eq!(parsed.add.unwrap(), vec!["new-tag"]);
        assert_eq!(parsed.remove.unwrap(), vec!["old-tag"]);
    }

    #[test]
    fn test_create_tag_request() {
        let request = CreateTagRequest {
            name: "my-tag".to_string(),
        };

        let json = serde_json::to_string(&request).unwrap();
        let parsed: CreateTagRequest = serde_json::from_str(&json).unwrap();

        assert_eq!(parsed.name, "my-tag");
    }

    // =============================================================================
    // COLLECTION TESTS
    // =============================================================================

    #[test]
    fn test_create_collection_request() {
        let request = CreateCollectionRequest {
            name: "My Collection".to_string(),
            description: Some("A test collection".to_string()),
        };

        let json = serde_json::to_string(&request).unwrap();
        let parsed: CreateCollectionRequest = serde_json::from_str(&json).unwrap();

        assert_eq!(parsed.name, "My Collection");
        assert_eq!(parsed.description, Some("A test collection".to_string()));
    }

    #[test]
    fn test_put_note_collection_request() {
        let collection_id = Uuid::new_v4();
        let request = PutNoteCollectionRequest { collection_id };

        let json = serde_json::to_string(&request).unwrap();
        let parsed: PutNoteCollectionRequest = serde_json::from_str(&json).unwrap();

        assert_eq!(parsed.collection_id, collection_id);
    }

    // =============================================================================
    // LIST NOTES TESTS
    // =============================================================================

    #[test]
    fn test_list_notes_request_defaults() {
        let request = ListNotesRequest {
            sort_by: None,
            sort_order: None,
            filter: None,
            limit: None,
            offset: None,
        };

        let json = serde_json::to_string(&request).unwrap();
        let parsed: ListNotesRequest = serde_json::from_str(&json).unwrap();

        assert!(parsed.sort_by.is_none());
        assert!(parsed.filter.is_none());
        assert!(parsed.limit.is_none());
    }

    #[test]
    fn test_list_notes_request_with_all_params() {
        let request = ListNotesRequest {
            sort_by: Some("updated_at".to_string()),
            sort_order: Some("asc".to_string()),
            filter: Some("starred".to_string()),
            limit: Some(20),
            offset: Some(10),
        };

        let json = serde_json::to_string(&request).unwrap();
        let parsed: ListNotesRequest = serde_json::from_str(&json).unwrap();

        assert_eq!(parsed.sort_by, Some("updated_at".to_string()));
        assert_eq!(parsed.sort_order, Some("asc".to_string()));
        assert_eq!(parsed.filter, Some("starred".to_string()));
        assert_eq!(parsed.limit, Some(20));
        assert_eq!(parsed.offset, Some(10));
    }

    #[test]
    fn test_note_summary() {
        let summary = NoteSummary {
            id: Uuid::new_v4(),
            title: "Test Title".to_string(),
            snippet: "Content preview...".to_string(),
            created_at_utc: Utc::now(),
            updated_at_utc: Utc::now(),
            starred: true,
            archived: false,
            tags: vec!["tag1".to_string(), "tag2".to_string()],
            has_revision: true,
            metadata: json!({"key": "value"}),
        };

        let json = serde_json::to_string(&summary).unwrap();
        let parsed: NoteSummary = serde_json::from_str(&json).unwrap();

        assert_eq!(parsed.title, "Test Title");
        assert!(parsed.starred);
        assert!(!parsed.archived);
        assert_eq!(parsed.tags.len(), 2);
        assert!(parsed.has_revision);
    }

    #[test]
    fn test_list_notes_response() {
        let response = ListNotesResponse {
            notes: vec![],
            total: 0,
        };

        let json = serde_json::to_string(&response).unwrap();
        let parsed: ListNotesResponse = serde_json::from_str(&json).unwrap();

        assert!(parsed.notes.is_empty());
        assert_eq!(parsed.total, 0);
    }

    // =============================================================================
    // UPDATE NOTE STATUS TESTS
    // =============================================================================

    #[test]
    fn test_update_note_status_request_star_only() {
        let request = UpdateNoteStatusRequest {
            starred: Some(true),
            archived: None,
        };

        let json = serde_json::to_string(&request).unwrap();
        let parsed: UpdateNoteStatusRequest = serde_json::from_str(&json).unwrap();

        assert_eq!(parsed.starred, Some(true));
        assert!(parsed.archived.is_none());
    }

    #[test]
    fn test_update_note_status_request_archive_only() {
        let request = UpdateNoteStatusRequest {
            starred: None,
            archived: Some(true),
        };

        let json = serde_json::to_string(&request).unwrap();
        let parsed: UpdateNoteStatusRequest = serde_json::from_str(&json).unwrap();

        assert!(parsed.starred.is_none());
        assert_eq!(parsed.archived, Some(true));
    }

    // =============================================================================
    // SEMANTIC TESTS
    // =============================================================================

    #[test]
    fn test_semantic_request() {
        let request = SemanticRequest {
            text: "Find similar notes about Rust".to_string(),
        };

        let json = serde_json::to_string(&request).unwrap();
        let parsed: SemanticRequest = serde_json::from_str(&json).unwrap();

        assert_eq!(parsed.text, "Find similar notes about Rust");
    }

    #[test]
    fn test_semantic_response() {
        let response = SemanticResponse {
            similar: vec![
                SearchHit {
                    note_id: Uuid::new_v4(),
                    score: 0.95,
                    snippet: Some("Rust programming...".to_string()),
                },
            ],
        };

        let json = serde_json::to_string(&response).unwrap();
        let parsed: SemanticResponse = serde_json::from_str(&json).unwrap();

        assert_eq!(parsed.similar.len(), 1);
        assert!(parsed.similar[0].score > 0.9);
    }

    // =============================================================================
    // USER METADATA TESTS
    // =============================================================================

    #[test]
    fn test_user_metadata_label() {
        let label = UserMetadataLabel {
            id: Uuid::new_v4(),
            note_id: Uuid::new_v4(),
            label: "Important".to_string(),
            color: Some("#FF0000".to_string()),
            created_at: Utc::now(),
        };

        let json = serde_json::to_string(&label).unwrap();
        let parsed: UserMetadataLabel = serde_json::from_str(&json).unwrap();

        assert_eq!(parsed.label, "Important");
        assert_eq!(parsed.color, Some("#FF0000".to_string()));
    }

    #[test]
    fn test_add_metadata_label_request() {
        let request = AddMetadataLabelRequest {
            label: "Priority".to_string(),
            color: Some("#00FF00".to_string()),
        };

        let json = serde_json::to_string(&request).unwrap();
        let parsed: AddMetadataLabelRequest = serde_json::from_str(&json).unwrap();

        assert_eq!(parsed.label, "Priority");
    }

    // =============================================================================
    // USER CONFIG TESTS
    // =============================================================================

    #[test]
    fn test_user_config() {
        let config = UserConfig {
            key: "theme".to_string(),
            value: json!("dark"),
            updated_at: Utc::now(),
        };

        let json = serde_json::to_string(&config).unwrap();
        let parsed: UserConfig = serde_json::from_str(&json).unwrap();

        assert_eq!(parsed.key, "theme");
        assert_eq!(parsed.value, json!("dark"));
    }

    #[test]
    fn test_update_config_request() {
        let request = UpdateConfigRequest {
            key: "font_size".to_string(),
            value: json!(14),
        };

        let json = serde_json::to_string(&request).unwrap();
        let parsed: UpdateConfigRequest = serde_json::from_str(&json).unwrap();

        assert_eq!(parsed.key, "font_size");
        assert_eq!(parsed.value, json!(14));
    }

    // =============================================================================
    // PROVENANCE TESTS
    // =============================================================================

    #[test]
    fn test_provenance_edge() {
        let edge = ProvenanceEdge {
            id: Uuid::new_v4(),
            revision_id: Uuid::new_v4(),
            source_note_id: Some(Uuid::new_v4()),
            source_url: None,
            relation: "derived_from".to_string(),
            created_at_utc: Utc::now(),
        };

        let json = serde_json::to_string(&edge).unwrap();
        let parsed: ProvenanceEdge = serde_json::from_str(&json).unwrap();

        assert_eq!(parsed.relation, "derived_from");
        assert!(parsed.source_note_id.is_some());
        assert!(parsed.source_url.is_none());
    }

    #[test]
    fn test_revision_node() {
        let node = RevisionNode {
            id: Uuid::new_v4(),
            parent_revision_id: Some(Uuid::new_v4()),
            created_at_utc: Utc::now(),
        };

        let json = serde_json::to_string(&node).unwrap();
        let parsed: RevisionNode = serde_json::from_str(&json).unwrap();

        assert!(parsed.parent_revision_id.is_some());
    }

    #[test]
    fn test_provenance_response() {
        let response = ProvenanceResponse {
            revisions: vec![
                RevisionNode {
                    id: Uuid::new_v4(),
                    parent_revision_id: None,
                    created_at_utc: Utc::now(),
                },
            ],
            edges: vec![],
        };

        let json = serde_json::to_string(&response).unwrap();
        let parsed: ProvenanceResponse = serde_json::from_str(&json).unwrap();

        assert_eq!(parsed.revisions.len(), 1);
        assert!(parsed.edges.is_empty());
    }

    // =============================================================================
    // LINK REQUEST TESTS
    // =============================================================================

    #[test]
    fn test_post_link_request() {
        let request = PostLinkRequest {
            to_note_id: Some(Uuid::new_v4()),
            to_url: None,
            kind: "related".to_string(),
            score: Some(0.85),
        };

        let json = serde_json::to_string(&request).unwrap();
        let parsed: PostLinkRequest = serde_json::from_str(&json).unwrap();

        assert!(parsed.to_note_id.is_some());
        assert!(parsed.to_url.is_none());
        assert_eq!(parsed.kind, "related");
        assert_eq!(parsed.score, Some(0.85));
    }

    #[test]
    fn test_create_link_request() {
        let request = CreateLinkRequest {
            to_note_id: Uuid::new_v4(),
            reason: Some("Related topic".to_string()),
        };

        let json = serde_json::to_string(&request).unwrap();
        let parsed: CreateLinkRequest = serde_json::from_str(&json).unwrap();

        assert_eq!(parsed.reason, Some("Related topic".to_string()));
    }

    // =============================================================================
    // UPDATE REQUESTS TESTS
    // =============================================================================

    #[test]
    fn test_update_note_title_request() {
        let request = UpdateNoteTitleRequest {
            title: "New Title".to_string(),
        };

        let json = serde_json::to_string(&request).unwrap();
        let parsed: UpdateNoteTitleRequest = serde_json::from_str(&json).unwrap();

        assert_eq!(parsed.title, "New Title");
    }

    #[test]
    fn test_update_original_content_request() {
        let request = UpdateOriginalContentRequest {
            content: "Updated original content".to_string(),
        };

        let json = serde_json::to_string(&request).unwrap();
        let parsed: UpdateOriginalContentRequest = serde_json::from_str(&json).unwrap();

        assert_eq!(parsed.content, "Updated original content");
    }
}
#[derive(Serialize, Deserialize)]
pub struct PostLinkResponse {
    pub link_id: Uuid,
}

// Semantic
#[derive(Serialize, Deserialize)]
pub struct SemanticRequest {
    pub text: String,
}
#[derive(Serialize, Deserialize)]
pub struct SemanticResponse {
    pub similar: Vec<SearchHit>,
}

// Create link between notes
#[derive(Serialize, Deserialize)]
pub struct CreateLinkRequest {
    pub to_note_id: Uuid,
    pub reason: Option<String>,
}

// Update note title
#[derive(Serialize, Deserialize)]
pub struct UpdateNoteTitleRequest {
    pub title: String,
}

// Update original note content
#[derive(Serialize, Deserialize)]
pub struct UpdateOriginalContentRequest {
    pub content: String,
}

// List notes with filtering and sorting
#[derive(Serialize, Deserialize)]
pub struct ListNotesRequest {
    pub sort_by: Option<String>,    // created_at, updated_at, accessed_at
    pub sort_order: Option<String>, // asc, desc
    pub filter: Option<String>,     // all, starred, archived, recent
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Serialize, Deserialize)]
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

#[derive(Serialize, Deserialize)]
pub struct ListNotesResponse {
    pub notes: Vec<NoteSummary>,
    pub total: i64,
}

// Update note status
#[derive(Serialize, Deserialize)]
pub struct UpdateNoteStatusRequest {
    pub starred: Option<bool>,
    pub archived: Option<bool>,
}

// User metadata labels
#[derive(Serialize, Deserialize, Clone)]
pub struct UserMetadataLabel {
    pub id: Uuid,
    pub note_id: Uuid,
    pub label: String,
    pub color: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Serialize, Deserialize)]
pub struct AddMetadataLabelRequest {
    pub label: String,
    pub color: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct UserConfig {
    pub key: String,
    pub value: JsonValue,
    pub updated_at: DateTime<Utc>,
}

#[derive(Serialize, Deserialize)]
pub struct UpdateConfigRequest {
    pub key: String,
    pub value: JsonValue,
}

// Provenance (simplified)
#[derive(Serialize, Deserialize)]
pub struct ProvenanceEdge {
    pub id: Uuid,
    pub revision_id: Uuid,
    pub source_note_id: Option<Uuid>,
    pub source_url: Option<String>,
    pub relation: String,
    pub created_at_utc: DateTime<Utc>,
}
#[derive(Serialize, Deserialize)]
pub struct RevisionNode {
    pub id: Uuid,
    pub parent_revision_id: Option<Uuid>,
    pub created_at_utc: DateTime<Utc>,
}
#[derive(Serialize, Deserialize)]
pub struct ProvenanceResponse {
    pub revisions: Vec<RevisionNode>,
    pub edges: Vec<ProvenanceEdge>,
}
