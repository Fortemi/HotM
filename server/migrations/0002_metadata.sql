-- Add metadata and status fields to notes

-- Add status fields to note table
ALTER TABLE note 
ADD COLUMN IF NOT EXISTS starred BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Create indexes for efficient filtering
CREATE INDEX IF NOT EXISTS idx_note_starred ON note(starred) WHERE starred = true;
CREATE INDEX IF NOT EXISTS idx_note_archived ON note(archived) WHERE archived = true;
CREATE INDEX IF NOT EXISTS idx_note_created_at ON note(created_at_utc);
CREATE INDEX IF NOT EXISTS idx_note_updated_at ON note(updated_at_utc);
CREATE INDEX IF NOT EXISTS idx_note_last_accessed ON note(last_accessed_at);

-- Add GIN index for JSONB metadata searches
CREATE INDEX IF NOT EXISTS idx_note_metadata ON note USING GIN (metadata);

-- Add metadata to note_revised_current for AI-generated metadata
ALTER TABLE note_revised_current
ADD COLUMN IF NOT EXISTS ai_metadata JSONB DEFAULT '{}';

-- Create index for AI metadata
CREATE INDEX IF NOT EXISTS idx_note_revised_ai_metadata ON note_revised_current USING GIN (ai_metadata);