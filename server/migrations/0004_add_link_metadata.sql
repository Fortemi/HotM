-- Add metadata column to link table to store keywords and other link-specific data
ALTER TABLE link ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Create index on metadata for efficient queries
CREATE INDEX IF NOT EXISTS idx_link_metadata ON link USING GIN (metadata);