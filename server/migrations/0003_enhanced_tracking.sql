-- Enhanced tracking for notes with detailed timestamps and metadata

-- Add tracking columns to note table
ALTER TABLE note 
ADD COLUMN IF NOT EXISTS starred BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS access_count INTEGER DEFAULT 0;

-- Add tracking columns to note_original
ALTER TABLE note_original
ADD COLUMN IF NOT EXISTS user_created_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS user_last_edited_at TIMESTAMPTZ DEFAULT NOW();

-- Add tracking columns to note_revision  
ALTER TABLE note_revision
ADD COLUMN IF NOT EXISTS ai_generated_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS user_last_edited_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS is_user_edited BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS generation_count INTEGER DEFAULT 1;

-- Create table for user metadata labels (quick access tags)
CREATE TABLE IF NOT EXISTS user_metadata_label (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id UUID NOT NULL REFERENCES note(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    color TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(note_id, label)
);

-- Create index for fast label lookups
CREATE INDEX IF NOT EXISTS idx_user_metadata_label_note_id ON user_metadata_label(note_id);
CREATE INDEX IF NOT EXISTS idx_user_metadata_label_label ON user_metadata_label(label);

-- Create table for user configuration/preferences
CREATE TABLE IF NOT EXISTS user_config (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default configuration
INSERT INTO user_config (key, value) VALUES 
    ('default_sort', '"created_desc"'::jsonb),
    ('default_group', '"none"'::jsonb),
    ('theme', '"dark"'::jsonb),
    ('recent_limit', '20'::jsonb),
    ('starred_pin_top', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Create view for recent notes with all tracking info
CREATE OR REPLACE VIEW recent_notes_view AS
SELECT 
    n.id,
    n.collection_id,
    n.format,
    n.source,
    n.created_at_utc,
    n.updated_at_utc,
    n.starred,
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

-- Create function to update access tracking
CREATE OR REPLACE FUNCTION update_note_access(note_id_param UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE note 
    SET 
        last_accessed_at = NOW(),
        access_count = access_count + 1
    WHERE id = note_id_param;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update user_last_edited_at on note_original changes
CREATE OR REPLACE FUNCTION update_original_edited_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.user_last_edited_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_original_edited
BEFORE UPDATE OF content ON note_original
FOR EACH ROW
WHEN (OLD.content IS DISTINCT FROM NEW.content)
EXECUTE FUNCTION update_original_edited_timestamp();

-- Create trigger to track user edits on revisions
CREATE OR REPLACE FUNCTION track_revision_edit()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.content IS DISTINCT FROM NEW.content THEN
        NEW.user_last_edited_at = NOW();
        NEW.is_user_edited = TRUE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER track_revision_user_edit
BEFORE UPDATE OF content ON note_revision
FOR EACH ROW
EXECUTE FUNCTION track_revision_edit();

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_note_starred ON note(starred) WHERE starred = TRUE;
CREATE INDEX IF NOT EXISTS idx_note_last_accessed ON note(last_accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_note_access_count ON note(access_count DESC);
CREATE INDEX IF NOT EXISTS idx_note_original_user_edited ON note_original(user_last_edited_at DESC);
CREATE INDEX IF NOT EXISTS idx_note_revision_ai_generated ON note_revision(ai_generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_note_revision_user_edited ON note_revision(user_last_edited_at DESC) WHERE user_last_edited_at IS NOT NULL;