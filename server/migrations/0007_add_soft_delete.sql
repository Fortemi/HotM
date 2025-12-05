-- Add soft delete capability to notes
-- This migration adds a deleted_at column for soft delete functionality

-- Add deleted_at column to note table
ALTER TABLE note ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Create index for faster queries filtering out deleted notes
CREATE INDEX IF NOT EXISTS idx_note_deleted_at ON note (deleted_at) WHERE deleted_at IS NULL;

-- Update the list_notes_view to exclude deleted notes
CREATE OR REPLACE VIEW list_notes_view AS
SELECT
    n.id as note_id,
    n.collection_id,
    n.format,
    n.source,
    n.created_at_utc,
    n.updated_at_utc,
    n.starred,
    n.archived,
    n.last_accessed_at,
    n.access_count,
    n.deleted_at,
    no.content as original_content,
    no.hash,
    no.user_created_at,
    no.user_last_edited_at,
    nrc.content as revised_content,
    nrc.ai_metadata,
    ngt.title,
    c.name as collection_name
FROM note n
LEFT JOIN note_original no ON n.id = no.note_id
LEFT JOIN note_revised_current nrc ON n.id = nrc.note_id
LEFT JOIN note_generated_title ngt ON n.id = ngt.note_id
LEFT JOIN collection c ON n.collection_id = c.id
WHERE n.deleted_at IS NULL;

-- Create a view for deleted (trash) notes
CREATE OR REPLACE VIEW deleted_notes_view AS
SELECT
    n.id as note_id,
    n.collection_id,
    n.format,
    n.source,
    n.created_at_utc,
    n.updated_at_utc,
    n.starred,
    n.archived,
    n.last_accessed_at,
    n.access_count,
    n.deleted_at,
    no.content as original_content,
    no.hash,
    nrc.content as revised_content,
    nrc.ai_metadata,
    ngt.title,
    c.name as collection_name
FROM note n
LEFT JOIN note_original no ON n.id = no.note_id
LEFT JOIN note_revised_current nrc ON n.id = nrc.note_id
LEFT JOIN note_generated_title ngt ON n.id = ngt.note_id
LEFT JOIN collection c ON n.collection_id = c.id
WHERE n.deleted_at IS NOT NULL;
