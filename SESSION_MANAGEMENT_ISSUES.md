# Session Management Issues & Solutions

## Current Problems

### 1. **Multiple Sessions Per User** ❌
**Issue**: Each login creates a new session row instead of replacing the old one
- User logs in → Session 1 created
- User logs in again → Session 2 created (Session 1 still exists)
- After 30 days: Hundreds of session rows accumulate
- Database bloat and performance issues

**Root Cause**: 
```typescript
// Current: Just inserts new session without removing old ones
.insert({ user_id, session_token_hash, expires_at })
```

**Impact**:
- Database table grows indefinitely
- Query performance degrades
- Security risk: Old tokens still valid until expiration

---

### 2. **Long Session Duration** ⚠️
**Issue**: Sessions expire after 30 days
- Users stay logged in for 30 days without interaction
- If token leaks, attacker has 30 days to use it
- No session refresh mechanism

**Root Cause**:
```typescript
expiresAt.setDate(expiresAt.getDate() + 30);  // 30 days
```

**Impact**:
- Security vulnerability
- Users can't manually end session except logout
- No refresh token for long-lived sessions

---

### 3. **Session Expiration Errors** 🔴
**Issue**: Users getting logged out frequently ("Session expired. Please sign in again")
- Possible causes:
  1. Token mismatch between client/server
  2. Timezone issues in expiration check
  3. Clock skew between services
  4. Session being revoked unexpectedly
  5. Database query issues

**Root Cause**: Need to investigate logs, but likely:
```typescript
if (new Date(sessionRow.expires_at).getTime() <= Date.now()) {
  // This can fail if expires_at is stored/compared incorrectly
}
```

---

## Best Practice Solutions

### Solution 1: Revoke Old Sessions on New Login ✅

**Approach**:
- When new session created, revoke previous active sessions for that user
- Keep only 1 active session per user (or last 3 for multi-device)
- Clean up expired sessions periodically

**Implementation**:
```typescript
export async function createSession(userId: string): Promise<string> {
  // 1. Revoke old active sessions for this user
  await supabaseAdmin
    .from("auth_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("revoked_at", null)  // Only active sessions
    .lt("expires_at", new Date());  // Only non-expired
  
  // 2. Create new session with SHORT duration
  const sessionToken = crypto.randomBytes(32).toString("hex");
  const sessionTokenHash = crypto.createHash("sha256").update(sessionToken).digest("hex");
  
  // Access token: 7 days, Refresh token: 30 days
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);  // 7 days instead of 30
  
  // ... insert session
}
```

---

### Solution 2: Use Refresh Token Pattern ✅

**Approach**:
- Short-lived access token (7 days)
- Long-lived refresh token (30 days)
- Client refreshes access token silently
- Better security: Compromised token has limited scope

**Implementation**:
```typescript
// auth_sessions table needs:
// - access_token_hash (7 day expiration)
// - refresh_token_hash (30 day expiration)
// - refreshed_at (track when last refreshed)

export async function refreshSession(refreshToken: string) {
  // Validate refresh token
  // Generate new access token
  // Keep refresh token valid
  // Return new access token
}
```

---

### Solution 3: Automatic Session Cleanup ✅

**Approach**:
- Run cleanup job periodically
- Delete revoked sessions after 1 day
- Delete expired sessions after 7 days
- Keeps database clean

**Implementation**:
```typescript
// New migration: Create cleanup job
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
  -- Delete revoked sessions older than 1 day
  DELETE FROM auth_sessions 
  WHERE revoked_at IS NOT NULL 
  AND revoked_at < NOW() - INTERVAL '1 day';
  
  -- Delete expired sessions older than 7 days
  DELETE FROM auth_sessions 
  WHERE expires_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Schedule to run daily
```

---

### Solution 4: Improve Error Diagnostics ✅

**Approach**:
- Log session state at each validation
- Track timezone/clock issues
- Add session statistics endpoint
- Better error messages

**Implementation**:
```typescript
export async function assertValidSession(input: SessionContext) {
  const sessionRow = ...;
  
  const now = Date.now();
  const expiresAt = new Date(sessionRow.expires_at).getTime();
  const timeUntilExpiry = expiresAt - now;
  
  // Log for debugging
  logger.info('Session validation', {
    userId: input.userId,
    expiresAt: sessionRow.expires_at,
    now: new Date().toISOString(),
    timeUntilExpiry: Math.round(timeUntilExpiry / 1000 / 60) + ' minutes',
    isExpired: timeUntilExpiry <= 0,
  });
  
  if (timeUntilExpiry <= 0) {
    throw new Error("Session expired. Please sign in again.");
  }
}
```

---

## Recommended Implementation Plan

### Phase 1: Quick Fixes (Immediate) ⏱️
1. **Reduce session duration**: 30 days → 7 days
2. **Revoke old sessions**: When new login, revoke previous sessions
3. **Add better logging**: Track session validation failures
4. **Estimate**: 1-2 hours

### Phase 2: Cleanup (Next Sprint) 🧹
1. **Add cleanup migration**: Remove expired/revoked sessions
2. **Add cleanup job**: Run daily
3. **Add session statistics**: Endpoint to check active sessions
4. **Estimate**: 2-3 hours

### Phase 3: Refresh Token (Optional) 🔄
1. **Implement refresh token pattern**
2. **Add token refresh endpoint**
3. **Update client to auto-refresh**
4. **Estimate**: 4-6 hours

---

## Database Schema Updates

### Add to auth_sessions table:
```sql
ALTER TABLE auth_sessions ADD COLUMN (
  token_type TEXT DEFAULT 'access',  -- 'access' or 'refresh'
  refreshed_at TIMESTAMPTZ,          -- Track refreshes
  last_used_at TIMESTAMPTZ           -- Track activity
);

-- Indexes for cleanup queries
CREATE INDEX idx_auth_sessions_revoked_at ON auth_sessions(revoked_at);
CREATE INDEX idx_auth_sessions_expires_at ON auth_sessions(expires_at);
```

---

## Security Implications

| Issue | Risk | Solution |
|-------|------|----------|
| Long session duration | Token theft has long impact | Reduce to 7 days |
| Multiple active sessions | Multiple compromise vectors | Revoke old sessions |
| No cleanup | Database bloat, old tokens work | Auto-cleanup |
| No refresh | Force re-login after expiry | Refresh token pattern |

---

## Expected Improvements

✅ **Reduced database bloat**: Cleanup removes old sessions
✅ **Better security**: Shorter token lifetime
✅ **Single session per device**: Clear session management  
✅ **Better debugging**: Improved logging and diagnostics
✅ **No forced logouts**: Refresh token prevents interruption
✅ **Cleaner UX**: Users stay logged in (but securely)

---

## Recommendation

**Start with Phase 1** (Quick Fixes):
1. Reduce session to 7 days
2. Revoke old sessions on new login
3. Add logging
4. Monitor for 1-2 weeks

**Then implement Phase 2** (Cleanup):
1. Add cleanup job
2. Remove accumulated old sessions
3. Add monitoring

**Later (if needed)**: Phase 3 - Refresh tokens for better UX/security balance
