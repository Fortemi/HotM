-- Add progress_message column to job_queue for WebSocket updates
ALTER TABLE job_queue 
ADD COLUMN IF NOT EXISTS progress_message TEXT;