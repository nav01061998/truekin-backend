import { supabaseAdmin } from "../lib/supabase.js";
import crypto from "crypto";

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
 * Returns the session token (plain text) that should be sent to the client
 * The token is hashed and stored in the database
 */
export async function createSession(userId: string): Promise<string> {
  // Generate a random session token
  const sessionToken = crypto.randomBytes(32).toString("hex");
  const sessionTokenHash = crypto.createHash("sha256").update(sessionToken).digest("hex");

  console.log("[createSession] Generated token length:", sessionToken.length);
  console.log("[createSession] Generated hash length:", sessionTokenHash.length);
  console.log("[createSession] Token:", sessionToken);
  console.log("[createSession] Hash:", sessionTokenHash);

  // Session expires in 30 days
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  const { error } = await supabaseAdmin
    .from("auth_sessions")
    .insert({
      user_id: userId,
      session_token_hash: sessionTokenHash,
      expires_at: expiresAt.toISOString(),
    });

  if (error) {
    console.error("[createSession] Failed to insert:", error);
    throw new Error(`Failed to create session: ${error.message}`);
  }

  console.log("[createSession] Session created successfully for user:", userId);
  return sessionToken;
}

export async function assertValidSession(input: SessionContext) {
  const userId = normalize(input.userId);
  const sessionToken = normalize(input.sessionToken);

  console.log("[assertValidSession] Validating:", {
    userId: userId ? "present" : "missing",
    sessionToken: sessionToken ? `present (length: ${sessionToken.length})` : "missing",
  });

  if (!userId || !sessionToken) {
    throw new Error("Unauthorized");
  }

  const { data: authUserResponse, error: authError } =
    await supabaseAdmin.auth.admin.getUserById(userId);

  if (authError || !authUserResponse?.user) {
    console.error("[assertValidSession] Auth user not found:", authError);
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
    throw sessionError;
  }

  if (!sessionRow) {
    console.error("[assertValidSession] No session row found for user:", userId);
    throw new Error("Session expired. Please sign in again.");
  }

  console.log("[assertValidSession] Session found, checking status");

  if (sessionRow.revoked_at) {
    throw new Error("Session revoked. Please sign in again.");
  }

  if (new Date(sessionRow.expires_at).getTime() <= Date.now()) {
    throw new Error("Session expired. Please sign in again.");
  }

  console.log("[assertValidSession] Session valid for user:", userId);
  return authUserResponse.user;
}