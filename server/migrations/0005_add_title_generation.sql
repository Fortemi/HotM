-- Add title generation support
-- This migration adds title column and TitleGeneration job type

-- Add title column to note table
ALTER TABLE note ADD COLUMN IF NOT EXISTS title TEXT;

-- Create index for title searches
CREATE INDEX IF NOT EXISTS idx_note_title ON note(title);

-- Add title generation job type to the enum
-- Note: Adding to enum requires checking if it doesn't already exist
DO $$ BEGIN
    -- Add the new job type if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'title_generation' 
        AND enumtypid = (
            SELECT oid FROM pg_type WHERE typname = 'job_type'
        )
    ) THEN
        ALTER TYPE job_type ADD VALUE 'title_generation';
    END IF;
END $$;