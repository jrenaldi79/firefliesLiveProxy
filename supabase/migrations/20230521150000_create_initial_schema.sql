-- Create the transcription_requests table
CREATE TABLE IF NOT EXISTS public.transcription_requests (
    id UUID PRIMARY KEY,
    transcription_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('processing', 'completed', 'error')),
    content TEXT,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    last_event_at TIMESTAMP WITH TIME ZONE,
    
    -- Add indexes for common query patterns
    CONSTRAINT uq_transcription_id UNIQUE (id)
);

-- Add an index on status for faster lookups
CREATE INDEX IF NOT EXISTS idx_transcription_requests_status 
    ON public.transcription_requests(status);

-- Add an index on transcription_id for lookups
CREATE INDEX IF NOT EXISTS idx_transcription_requests_transcription_id 
    ON public.transcription_requests(transcription_id);

-- Create a trigger to update the updated_at column automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop the trigger if it exists to avoid errors on subsequent runs
DROP TRIGGER IF EXISTS update_transcription_requests_updated_at ON public.transcription_requests;

-- Create the trigger
CREATE TRIGGER update_transcription_requests_updated_at
BEFORE UPDATE ON public.transcription_requests
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Add row level security if needed
ALTER TABLE public.transcription_requests ENABLE ROW LEVEL SECURITY;
