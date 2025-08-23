-- Add job logs column and cleanup policy
ALTER TABLE job_queue 
ADD COLUMN IF NOT EXISTS logs TEXT[];

-- Add index for faster job history queries
CREATE INDEX IF NOT EXISTS idx_job_queue_completed_at ON job_queue(completed_at DESC) 
WHERE status IN ('completed', 'failed');

-- Function to cleanup old jobs (keep last 100)
CREATE OR REPLACE FUNCTION cleanup_old_jobs()
RETURNS void AS $$
BEGIN
    DELETE FROM job_queue
    WHERE id NOT IN (
        SELECT id FROM job_queue
        ORDER BY 
            CASE 
                WHEN status IN ('pending', 'running') THEN 0
                ELSE 1
            END,
            completed_at DESC NULLS LAST
        LIMIT 100
    );
END;
$$ LANGUAGE plpgsql;

-- Add logs to job_history table as well
ALTER TABLE job_history
ADD COLUMN IF NOT EXISTS logs TEXT[];