-- Add model field to note_revision table to track which generation model was used
-- This enables better model upgrade tracking and revision provenance

-- Add model column to note_revision table
ALTER TABLE note_revision 
ADD COLUMN IF NOT EXISTS model TEXT;

-- Backfill existing AI-generated revisions with the default generation model
-- Only update rows where model is NULL and type is 'ai_enhancement'
UPDATE note_revision 
SET model = 'gpt-oss:20b' 
WHERE model IS NULL 
AND type = 'ai_enhancement';

-- Add comment to document the field
COMMENT ON COLUMN note_revision.model IS 'Generation model used for AI-enhanced revisions (e.g., gpt-oss:20b)';