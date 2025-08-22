-- Add specialized indices for tag searching and filtering
-- These indices improve performance for tag-based queries

-- Create a GIN index specifically for the tags array in metadata
-- This allows efficient queries like: metadata @> '{"tags": ["machine-learning"]}'
CREATE INDEX IF NOT EXISTS idx_note_metadata_tags 
ON note USING gin ((metadata->'tags'));

-- Create an index for tag existence checks
-- This helps with queries that check if tags exist
CREATE INDEX IF NOT EXISTS idx_note_metadata_tags_exists 
ON note ((metadata ? 'tags'));

-- Create a full-text search index on user metadata labels
-- This allows text search across user-defined tags
CREATE INDEX IF NOT EXISTS idx_user_metadata_label_tsv 
ON user_metadata_label 
USING gin (to_tsvector('english', label));

-- Create a materialized view for all unique tags (both AI and user)
-- This provides fast autocomplete and tag cloud functionality
CREATE MATERIALIZED VIEW IF NOT EXISTS all_tags_view AS
SELECT DISTINCT 
    tag,
    'ai' as source,
    COUNT(*) as usage_count
FROM (
    SELECT jsonb_array_elements_text(metadata->'tags') as tag
    FROM note
    WHERE metadata->'tags' IS NOT NULL
) ai_tags
GROUP BY tag

UNION ALL

SELECT DISTINCT
    label as tag,
    'user' as source,
    COUNT(*) as usage_count
FROM user_metadata_label
GROUP BY label
ORDER BY usage_count DESC, tag ASC;

-- Create unique index on the materialized view for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_all_tags_view_tag_source 
ON all_tags_view (tag, source);

-- Create index for fast tag lookups
CREATE INDEX IF NOT EXISTS idx_all_tags_view_tag 
ON all_tags_view (tag);

-- Create a function to refresh the tags view
-- Call this after bulk inserts or periodically
CREATE OR REPLACE FUNCTION refresh_tags_view()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY all_tags_view;
END;
$$ LANGUAGE plpgsql;

-- Add a comment explaining the indices
COMMENT ON INDEX idx_note_metadata_tags IS 'GIN index for efficient tag array searches in JSONB metadata';
COMMENT ON INDEX idx_user_metadata_label_tsv IS 'Full-text search index for user-defined tags';
COMMENT ON MATERIALIZED VIEW all_tags_view IS 'Consolidated view of all tags (AI and user) for fast autocomplete and filtering';