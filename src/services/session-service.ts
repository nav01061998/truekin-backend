import { supabaseAdmin } from "../lib/supabase.js";
import crypto from "crypto";

export type SessionContext = {
  userId: string;
  sessionToken: string;
};

function normalize(value: string) {
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
    throw new Error(`Failed to create session: ${error.message}`);
  }

  return sessionToken;
}

export async function assertValidSession(input: SessionContext) {
  const userId = normalize(input.userId);
  const sessionToken = normalize(input.sessionToken);

  if (!userId || !sessionToken) {
    throw new Error("Unauthorized");
  }

  const { data: authUserResponse, error: authError } =
    await supabaseAdmin.auth.admin.getUserById(userId);

  if (authError || !authUserResponse?.user) {
    throw new Error("Unauthorized");
  }

  // Hash the session token for comparison
  const sessionTokenHash = crypto.createHash("sha256").update(sessionToken).digest("hex");

  const { data: sessionRow, error: sessionError } = await supabaseAdmin
    .from("auth_sessions")
    .select("user_id, session_token_hash, expires_at, revoked_at")
    .eq("user_id", userId)
    .eq("session_token_hash", sessionTokenHash)
    .maybeSingle();

  if (sessionError) throw sessionError;

  if (!sessionRow) {
    throw new Error("Session expired. Please sign in again.");
  }

  if (sessionRow.revoked_at) {
    throw new Error("Session revoked. Please sign in again.");
  }

  if (new Date(sessionRow.expires_at).getTime() <= Date.now()) {
    throw new Error("Session expired. Please sign in again.");
  }

  return authUserResponse.user;
}