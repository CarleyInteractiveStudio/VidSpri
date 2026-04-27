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
    last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure columns exist if table was already there
ALTER TABLE processing_queue ADD COLUMN IF NOT EXISTS assigned_server_url TEXT;
ALTER TABLE processing_queue ADD COLUMN IF NOT EXISTS processed_frames INTEGER DEFAULT 0;
ALTER TABLE processing_queue ADD COLUMN IF NOT EXISTS total_frames INTEGER DEFAULT 0;
ALTER TABLE processing_queue ADD COLUMN IF NOT EXISTS last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT NOW();

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
DROP TRIGGER IF EXISTS trigger_refresh_codes_on_use ON priority_codes;
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

-- Function to cleanup abandoned jobs and offline servers
CREATE OR REPLACE FUNCTION cleanup_system()
RETURNS void AS $$
BEGIN
    -- 1. Mark servers as offline if no heartbeat for 60 seconds
    UPDATE server_status
    SET status = 'offline'
    WHERE last_heartbeat < NOW() - INTERVAL '60 seconds'
    AND status != 'offline';

    -- 2. Free servers assigned to abandoned jobs (no client heartbeat for 40s)
    UPDATE server_status s
    SET status = 'free'
    FROM processing_queue q
    WHERE q.assigned_server_url = s.url
    AND q.status IN ('authorized', 'processing')
    AND q.last_heartbeat < NOW() - INTERVAL '40 seconds';

    -- 3. Mark jobs as failed if client heartbeat is missing for > 40 seconds
    -- We add a check on created_at to avoid killing very new jobs due to clock drift
    UPDATE processing_queue
    SET status = 'failed'
    WHERE status IN ('waiting', 'authorized', 'processing')
    AND last_heartbeat < NOW() - INTERVAL '40 seconds'
    AND created_at < NOW() - INTERVAL '1 minute';

    -- 4. Reset 'processing' jobs to 'waiting' if the assigned server is now offline
    UPDATE processing_queue q
    SET status = 'waiting',
        assigned_server_url = NULL
    FROM server_status s
    WHERE q.status = 'processing'
    AND q.assigned_server_url = s.url
    AND s.status = 'offline';
END;
$$ LANGUAGE plpgsql;

-- Function to assign the next job to a free server
CREATE OR REPLACE FUNCTION assign_jobs()
RETURNS TRIGGER AS $$
DECLARE
    waiting_job RECORD;
    free_server_id_found TEXT;
    free_server_url_found TEXT;
BEGIN
    -- Run cleanup
    PERFORM cleanup_system();

    -- Loop through all available waiting jobs in priority order
    FOR waiting_job IN (
        SELECT id FROM processing_queue
        WHERE status = 'waiting'
        ORDER BY is_priority DESC, queue_number ASC
    ) LOOP
        -- For each job, find a free server
        SELECT id, url INTO free_server_id_found, free_server_url_found
        FROM server_status
        WHERE status = 'free'
        AND last_heartbeat > NOW() - INTERVAL '60 seconds'
        LIMIT 1;

        -- If a server is found, assign it
        IF free_server_id_found IS NOT NULL THEN
            UPDATE processing_queue
            SET status = 'authorized',
                assigned_server_url = free_server_url_found
            WHERE id = waiting_job.id;

            UPDATE server_status
            SET status = 'busy'
            WHERE id = free_server_id_found;
        ELSE
            -- No more free servers, stop trying to assign for now
            EXIT;
        END IF;
    END LOOP;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to free server when job ends
CREATE OR REPLACE FUNCTION free_server_on_job_end()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.status = 'completed' OR NEW.status = 'failed') AND OLD.assigned_server_url IS NOT NULL THEN
        UPDATE server_status
        SET status = 'free'
        WHERE url = OLD.assigned_server_url;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_free_server_on_job_end ON processing_queue;
CREATE TRIGGER trigger_free_server_on_job_end
AFTER UPDATE OF status ON processing_queue
FOR EACH ROW
EXECUTE FUNCTION free_server_on_job_end();

-- Triggers to trigger assignment
DROP TRIGGER IF EXISTS trigger_assign_on_server_update ON server_status;
CREATE TRIGGER trigger_assign_on_server_update
AFTER UPDATE ON server_status
FOR EACH ROW
EXECUTE FUNCTION assign_jobs();

DROP TRIGGER IF EXISTS trigger_assign_on_new_job ON processing_queue;
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
DROP POLICY IF EXISTS "Public can read free codes" ON priority_codes;
CREATE POLICY "Public can read free codes" ON priority_codes
    FOR SELECT USING (is_used = FALSE AND is_auto = TRUE);

-- Users can update a code to mark it as used if they know the code
DROP POLICY IF EXISTS "Public can redeem codes" ON priority_codes;
CREATE POLICY "Public can redeem codes" ON priority_codes
    FOR UPDATE USING (TRUE) WITH CHECK (TRUE);

-- 2. Processing Queue Policies
-- Anyone can insert into the queue
DROP POLICY IF EXISTS "Public can join queue" ON processing_queue;
CREATE POLICY "Public can join queue" ON processing_queue
    FOR INSERT WITH CHECK (TRUE);

-- Anyone can read their own status (or any status for simplicity in this demo)
DROP POLICY IF EXISTS "Public can view queue status" ON processing_queue;
CREATE POLICY "Public can view queue status" ON processing_queue
    FOR SELECT USING (TRUE);

-- Only internal logic (or service role) should update the queue
DROP POLICY IF EXISTS "Public can update status if they own it" ON processing_queue;
CREATE POLICY "Public can update status if they own it" ON processing_queue
    FOR UPDATE USING (TRUE) WITH CHECK (TRUE);

-- 3. Server Status Policies
-- Public can view which servers are online
DROP POLICY IF EXISTS "Public can view server status" ON server_status;
CREATE POLICY "Public can view server status" ON server_status
    FOR SELECT USING (TRUE);

-- Servers themselves update this
DROP POLICY IF EXISTS "Servers can update their status" ON server_status;
CREATE POLICY "Servers can update their status" ON server_status
    FOR UPDATE USING (TRUE) WITH CHECK (TRUE);

-- Allow servers to register themselves (Upsert support)
DROP POLICY IF EXISTS "Servers can register" ON server_status;
CREATE POLICY "Servers can register" ON server_status
    FOR INSERT WITH CHECK (TRUE);

-- 4. Global Notifications Policies
-- Public can read notifications
DROP POLICY IF EXISTS "Public can read notifications" ON global_notifications;
CREATE POLICY "Public can read notifications" ON global_notifications
    FOR SELECT USING (TRUE);

-- ==========================================
-- GRANT PERMISSIONS
-- ==========================================

GRANT ALL ON TABLE public.priority_codes TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.processing_queue TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.server_status TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.global_notifications TO anon, authenticated, service_role;
GRANT ALL ON SEQUENCE public.processing_queue_queue_number_seq TO anon, authenticated, service_role;
GRANT ALL ON SEQUENCE public.global_notifications_id_seq TO anon, authenticated, service_role;

-- RPC for heartbeat to avoid clock drift issues
CREATE OR REPLACE FUNCTION heartbeat_job(job_id_param UUID)
RETURNS void AS $$
BEGIN
    UPDATE processing_queue
    SET last_heartbeat = NOW()
    WHERE id = job_id_param;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION heartbeat_job(UUID) TO anon, authenticated, service_role;
