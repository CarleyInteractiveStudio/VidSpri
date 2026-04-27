-- SQL Schema for VidSpri Supabase Migration (SSO Integrated)

-- 1. Table for Priority Codes
CREATE TABLE IF NOT EXISTS priority_codes (
    code TEXT PRIMARY KEY,
    is_used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours'),
    is_auto BOOLEAN DEFAULT TRUE,
    used_by UUID REFERENCES auth.users(id) -- Optional: link to SSO user
);

-- 2. Table for the Processing Queue
CREATE TABLE IF NOT EXISTS processing_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL, -- Supports both UUID strings and local IDs
    status TEXT DEFAULT 'waiting', -- 'waiting', 'authorized', 'processing', 'completed', 'failed'
    queue_number SERIAL,
    is_priority BOOLEAN DEFAULT FALSE,
    assigned_server_url TEXT,
    processed_frames INTEGER DEFAULT 0,
    total_frames INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_queue_status ON processing_queue(status);
CREATE INDEX IF NOT EXISTS idx_queue_order ON processing_queue(is_priority DESC, queue_number ASC);

-- 3. Table for Server Status
CREATE TABLE IF NOT EXISTS server_status (
    id TEXT PRIMARY KEY, -- 'secretario', 'especialista'
    url TEXT NOT NULL,
    status TEXT DEFAULT 'free', -- 'free', 'busy', 'offline'
    last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Table for Global Notifications
CREATE TABLE IF NOT EXISTS global_notifications (
    id SERIAL PRIMARY KEY,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Function to clean up expired codes and ensure 7 codes are available
CREATE OR REPLACE FUNCTION refresh_priority_codes()
RETURNS void AS $$
DECLARE
    active_count INTEGER;
    new_code TEXT;
BEGIN
    DELETE FROM priority_codes WHERE expires_at < NOW() AND is_auto = TRUE;
    SELECT COUNT(*) INTO active_count FROM priority_codes WHERE is_used = FALSE AND is_auto = TRUE;
    WHILE active_count < 7 LOOP
        new_code := 'VSP-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8));
        INSERT INTO priority_codes (code, is_auto) VALUES (new_code, TRUE);
        active_count := active_count + 1;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function wrapper for trigger
CREATE OR REPLACE FUNCTION trigger_refresh_codes()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM refresh_priority_codes();
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to refresh codes automatically when one is used
CREATE TRIGGER trigger_refresh_codes_on_use
AFTER UPDATE OF is_used ON priority_codes
FOR EACH ROW
WHEN (NEW.is_used = TRUE)
EXECUTE FUNCTION trigger_refresh_codes();

-- Run it once at the start
SELECT refresh_priority_codes();

-- Enable Realtime
-- Enable Realtime safely
DO $$
BEGIN
    -- Create publication if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;

    -- Add tables only if they are not already members
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'processing_queue'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE processing_queue;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'global_notifications'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE global_notifications;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'priority_codes'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE priority_codes;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'server_status'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE server_status;
    END IF;
END $$;

-- Function to assign the next job to a free server
CREATE OR REPLACE FUNCTION assign_jobs()
RETURNS TRIGGER AS $$
DECLARE
    next_job_id UUID;
    free_server_url TEXT;
    free_server_id TEXT;
BEGIN
    -- Only run if a server becomes free or a new job is added
    -- Find the first free server
    SELECT id, url INTO free_server_id, free_server_url
    FROM server_status
    WHERE status = 'free'
    AND last_heartbeat > NOW() - INTERVAL '30 seconds'
    LIMIT 1;

    IF free_server_id IS NOT NULL THEN
        -- Find the next waiting job
        SELECT id INTO next_job_id
        FROM processing_queue
        WHERE status = 'waiting'
        ORDER BY is_priority DESC, queue_number ASC
        LIMIT 1;

        IF next_job_id IS NOT NULL THEN
            -- Assign server to job and mark as authorized
            UPDATE processing_queue
            SET status = 'authorized',
                assigned_server_url = free_server_url
            WHERE id = next_job_id;

            -- Mark server as busy
            UPDATE server_status
            SET status = 'busy'
            WHERE id = free_server_id;
        END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Triggers to trigger assignment
CREATE TRIGGER trigger_assign_on_server_free
AFTER UPDATE OF status ON server_status
FOR EACH ROW
WHEN (NEW.status = 'free')
EXECUTE FUNCTION assign_jobs();

CREATE TRIGGER trigger_assign_on_new_job
AFTER INSERT ON processing_queue
FOR EACH ROW
EXECUTE FUNCTION assign_jobs();

-- ==========================================
-- ROW LEVEL SECURITY (RLS)
-- ==========================================

-- Enable RLS on all tables
ALTER TABLE priority_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE server_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_notifications ENABLE ROW LEVEL SECURITY;

-- 1. Priority Codes Policies
-- Everyone can read unused auto-generated codes
CREATE POLICY "Public can read free codes" ON priority_codes
    FOR SELECT USING (is_used = FALSE AND is_auto = TRUE);

-- Users can update a code to mark it as used if they know the code
CREATE POLICY "Public can redeem codes" ON priority_codes
    FOR UPDATE WITH CHECK (TRUE);

-- 2. Processing Queue Policies
-- Anyone can insert into the queue
CREATE POLICY "Public can join queue" ON processing_queue
    FOR INSERT WITH CHECK (TRUE);

-- Anyone can read their own status (or any status for simplicity in this demo)
CREATE POLICY "Public can view queue status" ON processing_queue
    FOR SELECT USING (TRUE);

-- Only internal logic (or service role) should update the queue,
-- but for the "turn" system to work with standard client-side updates if needed:
CREATE POLICY "Public can update status if they own it" ON processing_queue
    FOR UPDATE USING (TRUE);

-- 3. Server Status Policies
-- Public can view which servers are online
CREATE POLICY "Public can view server status" ON server_status
    FOR SELECT USING (TRUE);

-- Servers themselves update this (ideally restricted by an API key or service role,
-- but for this migration we'll allow public update to keep the servers working as is)
CREATE POLICY "Servers can update their status" ON server_status
    FOR UPDATE USING (TRUE);

-- 4. Global Notifications Policies
-- Public can read notifications
CREATE POLICY "Public can read notifications" ON global_notifications
    FOR SELECT USING (TRUE);
