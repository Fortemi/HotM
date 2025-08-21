use serde::{Deserialize, Serialize};
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
}

#[derive(Serialize, Deserialize, Clone)]
pub struct NoteOriginal { pub content: String, pub hash: String }

#[derive(Serialize, Deserialize, Clone)]
pub struct NoteRevised { pub content: String, pub last_revision_id: Option<Uuid> }

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
pub struct CreateNoteResponse { pub noteId: Uuid }

#[derive(Serialize, Deserialize)]
pub struct PutRevisedRequest { pub content: String, pub rationale: Option<String> }
#[derive(Serialize, Deserialize)]
pub struct PutRevisedResponse { pub revisionId: Uuid, pub revisedContent: String }

#[derive(Serialize, Deserialize)]
pub struct SearchResponse { pub hits: Vec<SearchHit> }

#[derive(Serialize, Deserialize, Clone)]
pub struct SearchHit { pub note_id: Uuid, pub score: f32, pub snippet: Option<String> }
