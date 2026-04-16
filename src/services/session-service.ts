import { supabaseAdmin } from "../lib/supabase.js";

export type SessionContext = {
  userId: string;
  sessionToken: string;
};

function normalize(value: string) {
  return value.trim();
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

  const { data: sessionRow, error: sessionError } = await supabaseAdmin
    .from("auth_sessions")
    .select("user_id, session_token_hash, expires_at, revoked_at")
    .eq("user_id", userId)
    .eq("session_token_hash", sessionToken)
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