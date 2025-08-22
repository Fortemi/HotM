use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use uuid::Uuid;
use chrono::{DateTime, Utc};

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
    pub metadata: JsonValue,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct NoteOriginal { pub content: String, pub hash: String }

#[derive(Serialize, Deserialize, Clone)]
pub struct NoteRevised { 
    pub content: String, 
    pub last_revision_id: Option<Uuid>,
    pub ai_metadata: Option<JsonValue>,
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
pub struct CreateNoteRequest { pub content: String, pub format: Option<String>, pub source: Option<String> }
#[derive(Serialize, Deserialize)]
pub struct CreateNoteResponse { pub note_id: Uuid }

#[derive(Serialize, Deserialize)]
pub struct PutRevisedRequest { pub content: String, pub rationale: Option<String> }
#[derive(Serialize, Deserialize)]
pub struct PutRevisedResponse { pub revision_id: Uuid, pub revised_content: String }

#[derive(Serialize, Deserialize)]
pub struct SearchResponse { pub notes: Vec<SearchHit> }

#[derive(Serialize, Deserialize, Clone)]
pub struct SearchHit { pub note_id: Uuid, pub score: f32, pub snippet: Option<String> }

// Tags
#[derive(Serialize, Deserialize)]
pub struct PutNoteTagsRequest { pub add: Option<Vec<String>>, pub remove: Option<Vec<String>> }
#[derive(Serialize, Deserialize)]
pub struct PutNoteTagsResponse { pub tags: Vec<String> }

#[derive(Serialize, Deserialize)]
pub struct CreateTagRequest { pub name: String }
#[derive(Serialize, Deserialize)]
pub struct CreateTagResponse { pub name: String }

// Collections
#[derive(Serialize, Deserialize)]
pub struct CreateCollectionRequest { pub name: String, pub description: Option<String> }
#[derive(Serialize, Deserialize)]
pub struct CreateCollectionResponse { pub collection_id: Uuid }
#[derive(Serialize, Deserialize)]
pub struct PutNoteCollectionRequest { pub collection_id: Uuid }
#[derive(Serialize, Deserialize)]
pub struct PutNoteCollectionResponse { pub collection_id: Uuid }

// Links
#[derive(Serialize, Deserialize)]
pub struct PostLinkRequest { pub to_note_id: Option<Uuid>, pub to_url: Option<String>, pub kind: String, pub score: Option<f32> }
#[derive(Serialize, Deserialize)]
pub struct PostLinkResponse { pub link_id: Uuid }

// Semantic
#[derive(Serialize, Deserialize)]
pub struct SemanticRequest { pub text: String }
#[derive(Serialize, Deserialize)]
pub struct SemanticResponse { pub similar: Vec<SearchHit> }

// Create link between notes
#[derive(Serialize, Deserialize)]
pub struct CreateLinkRequest {
    pub to_note_id: Uuid,
    pub reason: Option<String>,
}

// List notes with filtering and sorting
#[derive(Serialize, Deserialize)]
pub struct ListNotesRequest {
    pub sort_by: Option<String>,  // created_at, updated_at, accessed_at
    pub sort_order: Option<String>, // asc, desc
    pub filter: Option<String>,    // all, starred, archived, recent
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

// Provenance (simplified)
#[derive(Serialize, Deserialize)]
pub struct ProvenanceEdge { pub id: Uuid, pub revision_id: Uuid, pub source_note_id: Option<Uuid>, pub source_url: Option<String>, pub relation: String, pub created_at_utc: DateTime<Utc> }
#[derive(Serialize, Deserialize)]
pub struct RevisionNode { pub id: Uuid, pub parent_revision_id: Option<Uuid>, pub created_at_utc: DateTime<Utc> }
#[derive(Serialize, Deserialize)]
pub struct ProvenanceResponse { pub revisions: Vec<RevisionNode>, pub edges: Vec<ProvenanceEdge> }
