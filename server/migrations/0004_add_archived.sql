-- Add archived field for soft delete functionality

-- Add archived column to note table
ALTER TABLE note 
ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;

-- Create index for fast archived lookups
CREATE INDEX IF NOT EXISTS idx_note_archived ON note(archived) WHERE archived = TRUE;

-- Update the recent_notes_view to include archived status
DROP VIEW IF EXISTS recent_notes_view;
CREATE VIEW recent_notes_view AS
SELECT 
    n.id,
    n.collection_id,
    n.format,
    n.source,
    n.created_at_utc,
    n.updated_at_utc,
    n.starred,
    n.archived,
    n.last_accessed_at,
    n.access_count,
    no.content as original_content,
    no.user_created_at,
    no.user_last_edited_at as original_last_edited,
    nr.content as revised_content,
    nr.ai_generated_at,
    nr.user_last_edited_at as revised_last_edited,
    nr.is_user_edited,
    nr.generation_count,
    GREATEST(
        n.created_at_utc,
        COALESCE(no.user_last_edited_at, n.created_at_utc),
        COALESCE(nr.user_last_edited_at, n.created_at_utc),
        COALESCE(nr.ai_generated_at, n.created_at_utc)
    ) as last_activity_at
FROM note n
LEFT JOIN note_original no ON n.id = no.note_id
LEFT JOIN note_revision nr ON n.id = nr.note_id
ORDER BY last_activity_at DESC;