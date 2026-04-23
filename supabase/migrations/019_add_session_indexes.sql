-- Add indexes for session management queries
-- These indexes improve performance for:
-- 1. Revoking old sessions by user
-- 2. Finding expired sessions for cleanup
-- 3. General session lookups

-- Index for quickly finding active sessions (revoked_at IS NULL) by user_id
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id_active
  ON auth_sessions(user_id, revoked_at)
  WHERE revoked_at IS NULL;

-- Index for finding expired sessions
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at
  ON auth_sessions(expires_at);

-- Index for finding revoked sessions
CREATE INDEX IF NOT EXISTS idx_auth_sessions_revoked_at
  ON auth_sessions(revoked_at);

-- Composite index for finding active non-expired sessions by user
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id_expires_at
  ON auth_sessions(user_id, expires_at)
  WHERE revoked_at IS NULL;
