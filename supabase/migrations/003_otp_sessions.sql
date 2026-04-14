-- OTP sessions table for custom OTP verification (MSG91 + Twilio)
-- Stores hashed OTPs with expiry and attempt tracking.

CREATE TABLE IF NOT EXISTS public.otp_sessions (
  phone       TEXT PRIMARY KEY,
  otp_hash    TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for cleanup of expired sessions
CREATE INDEX IF NOT EXISTS idx_otp_sessions_expires_at ON public.otp_sessions (expires_at);

-- RLS: only service role can access this table (edge functions use service role key)
ALTER TABLE public.otp_sessions ENABLE ROW LEVEL SECURITY;

-- No public policies — only service_role can read/write
-- Edge functions use SUPABASE_SERVICE_ROLE_KEY which bypasses RLS

-- Auto-clean expired OTPs every hour (optional — can also be done via cron)
-- For now, the edge functions clean up on verify.

COMMENT ON TABLE public.otp_sessions IS 'Stores hashed OTPs for custom phone verification via MSG91 (India) and Twilio (international).';
