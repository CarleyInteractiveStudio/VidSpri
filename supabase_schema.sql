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
    status TEXT DEFAULT 'waiting', -- 'waiting', 'processing', 'completed', 'failed'
    queue_number SERIAL,
    is_priority BOOLEAN DEFAULT FALSE,
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

-- Enable Realtime
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE processing_queue;
ALTER PUBLICATION supabase_realtime ADD TABLE global_notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE priority_codes;
ALTER PUBLICATION supabase_realtime ADD TABLE server_status;
