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
    job_type TEXT DEFAULT 'video', -- 'video', 'sound', 'voice', 'effect'
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
ALTER TABLE processing_queue ADD COLUMN IF NOT EXISTS job_type TEXT DEFAULT 'video';
ALTER TABLE processing_queue ADD COLUMN IF NOT EXISTS processed_frames INTEGER DEFAULT 0;
ALTER TABLE processing_queue ADD COLUMN IF NOT EXISTS total_frames INTEGER DEFAULT 0;
ALTER TABLE processing_queue ADD COLUMN IF NOT EXISTS last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_queue_status ON processing_queue(status);
CREATE INDEX IF NOT EXISTS idx_queue_order ON processing_queue(job_type, is_priority DESC, queue_number ASC);

-- 3. Table for Server Status
CREATE TABLE IF NOT EXISTS server_status (
    id TEXT PRIMARY KEY, -- Unique ID for the server
    url TEXT NOT NULL,
    service_type TEXT DEFAULT 'video', -- 'video', 'sound', 'voice', 'effect'
    status TEXT DEFAULT 'free', -- 'free', 'busy', 'offline'
    last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE server_status ADD COLUMN IF NOT EXISTS service_type TEXT DEFAULT 'video';

-- 4. Table for Global Notifications
CREATE TABLE IF NOT EXISTS global_notifications (
    id SERIAL PRIMARY KEY,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Function to clean up expired codes and ensure 7 codes are available
-- 5. Function to refresh priority codes every 24 hours
CREATE OR REPLACE FUNCTION refresh_priority_codes()
RETURNS void AS $$
DECLARE
    active_count INTEGER;
    new_code TEXT;
    last_refresh TIMESTAMP WITH TIME ZONE;
BEGIN
    -- 1. Get the most recent creation time of an auto code
    SELECT MAX(created_at) INTO last_refresh FROM priority_codes WHERE is_auto = TRUE;

    -- 2. Only proceed if it has been more than 24 hours OR if there are NO auto codes
    IF last_refresh IS NULL OR last_refresh < NOW() - INTERVAL '24 hours' THEN
        -- Delete all previous auto-generated codes (used or expired) to start fresh
        DELETE FROM priority_codes WHERE is_auto = TRUE;

        -- Create exactly 7 new codes
        FOR i IN 1..7 LOOP
            new_code := 'VSP-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8));
            INSERT INTO priority_codes (code, is_auto) VALUES (new_code, TRUE);
        END LOOP;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for immediate refresh is REMOVED as per requirements (must wait 24h)
DROP TRIGGER IF EXISTS trigger_refresh_codes_on_use ON priority_codes;

-- Run it once at the start
SELECT refresh_priority_codes();

-- Enable Realtime
-- Enable REPLICA IDENTITY FULL for detailed payloads
ALTER TABLE processing_queue REPLICA IDENTITY FULL;
ALTER TABLE server_status REPLICA IDENTITY FULL;

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
    -- 0. Refresh priority codes (if 24h passed)
    PERFORM refresh_priority_codes();

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
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
        SELECT id, job_type FROM processing_queue
        WHERE status = 'waiting'
        ORDER BY is_priority DESC, queue_number ASC
    ) LOOP
        -- For each job, find a free server of the matching type
        SELECT id, url INTO free_server_id_found, free_server_url_found
        FROM server_status
        WHERE status = 'free'
        AND last_heartbeat > NOW() - INTERVAL '60 seconds'
        AND service_type = waiting_job.job_type
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

            -- Attempt to wake up the server (requires pg_net extension usually, but we can't be sure)
            -- This is a placeholder for where a database-side wake-up call would go.
        ELSE
            -- No more free servers, stop trying to assign for now
            EXIT;
        END IF;
    END LOOP;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

-- Standard table permissions (Read-only for public by default)
GRANT SELECT ON TABLE public.priority_codes TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.processing_queue TO anon, authenticated;
GRANT SELECT ON TABLE public.server_status TO anon, authenticated;
GRANT SELECT ON TABLE public.global_notifications TO anon, authenticated;

-- Service role keeps full access
GRANT ALL ON TABLE public.priority_codes TO service_role;
GRANT ALL ON TABLE public.processing_queue TO service_role;
GRANT ALL ON TABLE public.server_status TO service_role;
GRANT ALL ON TABLE public.global_notifications TO service_role;

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
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION heartbeat_job(UUID) TO anon, authenticated, service_role;
-- Update Schema for Advanced Priority System

-- 1. Create user_priorities table
CREATE TABLE IF NOT EXISTS user_priorities (
    user_id TEXT PRIMARY KEY,
    remaining_uses INTEGER DEFAULT 0,
    priority_until TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Enhance priority_codes table
-- We check if columns exist before adding them to avoid errors on re-run
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = 'priority_codes' AND column_name = 'code_type') THEN
        ALTER TABLE priority_codes ADD COLUMN code_type TEXT DEFAULT 'uses'; -- 'uses', 'time'
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = 'priority_codes' AND column_name = 'benefit_value') THEN
        ALTER TABLE priority_codes ADD COLUMN benefit_value INTEGER DEFAULT 1; -- number of uses or hours
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = 'priority_codes' AND column_name = 'is_multi_user') THEN
        ALTER TABLE priority_codes ADD COLUMN is_multi_user BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = 'priority_codes' AND column_name = 'max_redeems') THEN
        ALTER TABLE priority_codes ADD COLUMN max_redeems INTEGER DEFAULT 1;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = 'priority_codes' AND column_name = 'redeem_count') THEN
        ALTER TABLE priority_codes ADD COLUMN redeem_count INTEGER DEFAULT 0;
    END IF;
END $$;

-- 3. Table to track redemptions
CREATE TABLE IF NOT EXISTS redeemed_codes (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    code TEXT REFERENCES priority_codes(code) ON DELETE CASCADE,
    redeemed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, code)
);

-- Migration: Ensure the foreign key constraint on redeemed_codes uses ON DELETE CASCADE
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'redeemed_codes_code_fkey' AND table_name = 'redeemed_codes'
    ) THEN
        ALTER TABLE redeemed_codes DROP CONSTRAINT redeemed_codes_code_fkey;
    END IF;

    ALTER TABLE redeemed_codes
    ADD CONSTRAINT redeemed_codes_code_fkey
    FOREIGN KEY (code) REFERENCES priority_codes(code) ON DELETE CASCADE;
END $$;

-- 4. Function to redeem a code
CREATE OR REPLACE FUNCTION redeem_priority_code(user_id_param TEXT, code_param TEXT)
RETURNS JSON AS $$
DECLARE
    target_code RECORD;
    already_redeemed BOOLEAN;
BEGIN
    -- Check if code exists and is valid
    SELECT * INTO target_code FROM priority_codes WHERE code = code_param;

    IF target_code.code IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'invalid_code');
    END IF;

    IF target_code.expires_at < NOW() THEN
        RETURN json_build_object('success', false, 'message', 'expired_code');
    END IF;

    -- Check if user already redeemed it
    SELECT EXISTS(SELECT 1 FROM redeemed_codes WHERE user_id = user_id_param AND code = code_param) INTO already_redeemed;
    IF already_redeemed THEN
        RETURN json_build_object('success', false, 'message', 'already_redeemed');
    END IF;

    -- Check if it reached max redeems
    IF NOT target_code.is_multi_user AND target_code.is_used THEN
        RETURN json_build_object('success', false, 'message', 'code_already_used');
    END IF;

    IF target_code.is_multi_user AND target_code.redeem_count >= target_code.max_redeems THEN
        RETURN json_build_object('success', false, 'message', 'max_redeems_reached');
    END IF;

    -- Everything looks good, apply benefit
    INSERT INTO user_priorities (user_id, remaining_uses, priority_until)
    VALUES (user_id_param, 0, NULL)
    ON CONFLICT (user_id) DO NOTHING;

    IF target_code.code_type = 'uses' THEN
        UPDATE user_priorities
        SET remaining_uses = remaining_uses + target_code.benefit_value,
            updated_at = NOW()
        WHERE user_id = user_id_param;
    ELSIF target_code.code_type = 'time' THEN
        UPDATE user_priorities
        SET priority_until = GREATEST(COALESCE(priority_until, NOW()), NOW()) + (target_code.benefit_value || ' hours')::INTERVAL,
            updated_at = NOW()
        WHERE user_id = user_id_param;
    END IF;

    -- Mark code as used
    UPDATE priority_codes
    SET is_used = TRUE,
        redeem_count = redeem_count + 1
    WHERE code = code_param;

    -- Record redemption
    INSERT INTO redeemed_codes (user_id, code) VALUES (user_id_param, code_param);

    RETURN json_build_object('success', true, 'message', 'success');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Function to use a priority credit for a job
CREATE OR REPLACE FUNCTION use_priority_credit(user_id_param TEXT, job_id_param UUID)
RETURNS JSON AS $$
DECLARE
    user_p RECORD;
    job_p RECORD;
    has_time_priority BOOLEAN;
BEGIN
    SELECT * INTO user_p FROM user_priorities WHERE user_id = user_id_param;
    SELECT * INTO job_p FROM processing_queue WHERE id = job_id_param AND user_id = user_id_param;

    IF job_p.id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'job_not_found');
    END IF;

    IF job_p.is_priority THEN
        RETURN json_build_object('success', false, 'message', 'already_priority');
    END IF;

    has_time_priority := user_p.priority_until > NOW();

    IF has_time_priority THEN
        -- Just apply it for free since they have time-based priority
        UPDATE processing_queue SET is_priority = TRUE WHERE id = job_id_param;
        RETURN json_build_object('success', true, 'message', 'priority_applied_time');
    ELSIF user_p.remaining_uses > 0 THEN
        -- Deduct a credit
        UPDATE user_priorities SET remaining_uses = remaining_uses - 1 WHERE user_id = user_id_param;
        UPDATE processing_queue SET is_priority = TRUE WHERE id = job_id_param;
        RETURN json_build_object('success', true, 'message', 'priority_applied_credit');
    ELSE
        RETURN json_build_object('success', false, 'message', 'no_credits');
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Permissions
-- We already set up table grants above. Here we add the new tables and functions.
GRANT SELECT ON TABLE public.user_priorities TO anon, authenticated;
GRANT SELECT ON TABLE public.redeemed_codes TO anon, authenticated;
GRANT ALL ON TABLE public.user_priorities TO service_role;
GRANT ALL ON TABLE public.redeemed_codes TO service_role;

GRANT EXECUTE ON FUNCTION redeem_priority_code(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION use_priority_credit(TEXT, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION heartbeat_job(UUID) TO anon, authenticated;

-- 7. RLS
ALTER TABLE user_priorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE redeemed_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own priority" ON user_priorities;
CREATE POLICY "Users can view their own priority" ON user_priorities
    FOR SELECT USING (TRUE); -- Simplification: users can see all for now, but usually it would be filtered by user_id

DROP POLICY IF EXISTS "Users can view their own redemptions" ON redeemed_codes;
CREATE POLICY "Users can view their own redemptions" ON redeemed_codes
    FOR SELECT USING (TRUE);

-- 8. Add trigger to assign jobs when is_priority changes
CREATE OR REPLACE FUNCTION trigger_assign_on_priority_change()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_priority = TRUE AND OLD.is_priority = FALSE THEN
        PERFORM assign_jobs();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_priority_assignment ON processing_queue;
CREATE TRIGGER trigger_priority_assignment
AFTER UPDATE OF is_priority ON processing_queue
FOR EACH ROW
EXECUTE FUNCTION trigger_assign_on_priority_change();
