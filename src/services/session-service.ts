import { supabaseAdmin } from "../lib/supabase.js";
import crypto from "crypto";
// @ts-ignore - uuid has issues with module resolution
import { v4 as uuidv4 } from "uuid";
import { logAuth } from "../lib/logger.js";

export type SessionContext = {
  userId: string;
  sessionToken: string;
};

function normalize(value: string) {
  if (!value || typeof value !== 'string') return '';
  return value.trim();
}

/**
 * Create a new session for a user
 * Revokes all previous active sessions and creates a new one
 * Returns the session token (plain text) that should be sent to the client
 * The token is hashed and stored in the database
 */
export async function createSession(userId: string): Promise<string> {
  const requestId = uuidv4();

  try {
    // 1. Revoke all previous active sessions for this user
    console.log("[createSession] Revoking previous sessions for user:", userId);
    const { error: revokeError } = await supabaseAdmin
      .from("auth_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("revoked_at", null); // Only revoke active sessions

    if (revokeError) {
      console.warn("[createSession] Warning - failed to revoke old sessions:", revokeError);
      // Don't throw, continue with new session creation
    } else {
      console.log("[createSession] Successfully revoked previous sessions for user:", userId);
    }

    // 2. Generate a random session token
    const sessionToken = crypto.randomBytes(32).toString("hex");
    const sessionTokenHash = crypto.createHash("sha256").update(sessionToken).digest("hex");

    console.log("[createSession] Generated token length:", sessionToken.length);
    console.log("[createSession] Generated hash length:", sessionTokenHash.length);
    console.log("[createSession] Token:", sessionToken);
    console.log("[createSession] Hash:", sessionTokenHash);

    // 3. Session expires in 7 days (reduced from 30 days for better security)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { error } = await supabaseAdmin
      .from("auth_sessions")
      .insert({
        user_id: userId,
        session_token_hash: sessionTokenHash,
        expires_at: expiresAt.toISOString(),
      });

    if (error) {
      console.error("[createSession] Failed to insert:", error);
      logAuth(requestId, "LOGIN", userId, false, `Failed to create session: ${error.message}`);
      throw new Error(`Failed to create session: ${error.message}`);
    }

    console.log("[createSession] Session created successfully for user:", userId);
    logAuth(requestId, "LOGIN", userId, true, `Session created, expires in 7 days at ${expiresAt.toISOString()}`);
    return sessionToken;
  } catch (error) {
    console.error("[createSession] Error:", error);
    logAuth(requestId, "LOGIN", userId, false, error instanceof Error ? error.message : String(error));
    throw error;
  }
}

export async function assertValidSession(input: SessionContext) {
  const requestId = uuidv4();

  console.log("[assertValidSession] Validating session for userId:", input.userId);
  const userId = normalize(input.userId);
  const sessionToken = normalize(input.sessionToken);

  console.log("[assertValidSession] Validating:", {
    userId: userId ? "present" : "missing",
    sessionToken: sessionToken ? `present (length: ${sessionToken.length})` : "missing",
  });

  if (!userId || !sessionToken) {
    logAuth(requestId, "TOKEN_VALIDATION", input.userId || "unknown", false, "Missing userId or sessionToken");
    throw new Error("Unauthorized");
  }

  const { data: authUserResponse, error: authError } =
    await supabaseAdmin.auth.admin.getUserById(userId);

  if (authError || !authUserResponse?.user) {
    console.error("[assertValidSession] Auth user not found:", authError);
    logAuth(requestId, "TOKEN_VALIDATION", userId, false, `Auth user not found: ${authError?.message || "unknown"}`);
    throw new Error("Unauthorized");
  }

  console.log("[assertValidSession] Auth user found:", userId);

  // Hash the session token for comparison
  const sessionTokenHash = crypto.createHash("sha256").update(sessionToken).digest("hex");

  console.log("[assertValidSession] Looking for session with hash:", sessionTokenHash);

  const { data: sessionRow, error: sessionError } = await supabaseAdmin
    .from("auth_sessions")
    .select("user_id, session_token_hash, expires_at, revoked_at")
    .eq("user_id", userId)
    .eq("session_token_hash", sessionTokenHash)
    .maybeSingle();

  if (sessionError) {
    console.error("[assertValidSession] Session lookup error:", sessionError);
    logAuth(requestId, "TOKEN_VALIDATION", userId, false, `Session lookup error: ${sessionError.message}`);
    throw sessionError;
  }

  if (!sessionRow) {
    console.error("[assertValidSession] No session row found for user:", userId);
    logAuth(requestId, "TOKEN_VALIDATION", userId, false, "No session row found");
    throw new Error("Session expired. Please sign in again.");
  }

  console.log("[assertValidSession] Session found, checking status");

  if (sessionRow.revoked_at) {
    console.warn("[assertValidSession] Session is revoked for user:", userId);
    logAuth(requestId, "TOKEN_VALIDATION", userId, false, "Session revoked");
    throw new Error("Session revoked. Please sign in again.");
  }

  // Check expiration with detailed logging
  const now = Date.now();
  const expiresAtTime = new Date(sessionRow.expires_at).getTime();
  const timeUntilExpiry = expiresAtTime - now;
  const minutesUntilExpiry = Math.round(timeUntilExpiry / 1000 / 60);
  const hoursUntilExpiry = Math.round(timeUntilExpiry / 1000 / 60 / 60);
  const daysUntilExpiry = Math.round(timeUntilExpiry / 1000 / 60 / 60 / 24);

  console.log("[assertValidSession] Session expiry check:", {
    expiresAt: sessionRow.expires_at,
    nowUTC: new Date().toISOString(),
    timeUntilExpiryMs: timeUntilExpiry,
    minutesUntilExpiry,
    hoursUntilExpiry,
    daysUntilExpiry,
    isExpired: timeUntilExpiry <= 0,
  });

  if (timeUntilExpiry <= 0) {
    const minutesPastExpiry = Math.round(-timeUntilExpiry / 1000 / 60);
    console.warn("[assertValidSession] Session expired for user:", userId, "- expired", minutesPastExpiry, "minutes ago");
    logAuth(requestId, "TOKEN_VALIDATION", userId, false, `Session expired ${minutesPastExpiry} minutes ago`);
    throw new Error("Session expired. Please sign in again.");
  }

  console.log("[assertValidSession] Session valid for user:", userId, "- expires in", minutesUntilExpiry, "minutes");
  logAuth(requestId, "TOKEN_VALIDATION", userId, true, `Session valid, expires in ${minutesUntilExpiry} minutes`);
  return authUserResponse.user;
}