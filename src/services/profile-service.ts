import { supabaseAdmin } from "../lib/supabase.js";
import { assertValidSession, type SessionContext } from "./session-service.js";

export type Profile = {
  id: string;
  phone: string;
  display_name: string | null;
  gender: string | null;
  age: number | null;
  avatar_url: string | null;
  onboarding_completed: boolean;
};

const profileSelect =
  "id, phone, display_name, gender, age, avatar_url, onboarding_completed";

function normalizePhone(phone: string): string {
  return phone.trim().replace(/[^\d+]/g, "");
}

async function ensureProfileRow(userId: string, phone: string): Promise<void> {
  const normalizedPhone = normalizePhone(phone);

  const { error } = await supabaseAdmin.from("profiles").upsert(
    {
      id: userId,
      phone: normalizedPhone,
    },
    { onConflict: "id" }
  );

  if (error) throw error;
}

export async function getCurrentUserProfile(
  input: SessionContext
): Promise<Profile> {
  const authUser = await assertValidSession(input);

  if (!authUser.phone) {
    throw new Error("User profile is incomplete.");
  }

  await ensureProfileRow(authUser.id, authUser.phone);

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select(profileSelect)
    .eq("id", authUser.id)
    .single();

  if (error) throw error;
  if (!data) throw new Error("Profile could not be loaded");

  return data as Profile;
}

export async function updateDisplayName(input: {
  userId: string;
  sessionToken: string;
  displayName: string;
}): Promise<Profile> {
  const authUser = await assertValidSession({
    userId: input.userId,
    sessionToken: input.sessionToken,
  });

  const displayName = input.displayName.replace(/\s+/g, " ").trim();

  if (!displayName) {
    throw new Error("Display name cannot be empty");
  }

  if (displayName.length > 50) {
    throw new Error("Display name too long");
  }

  if (/[\u0000-\u001F\u007F]/.test(displayName)) {
    throw new Error("Invalid characters in name");
  }

  if (!authUser.phone) {
    throw new Error("User profile is incomplete.");
  }

  await ensureProfileRow(authUser.id, authUser.phone);

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({ display_name: displayName })
    .eq("id", authUser.id)
    .select(profileSelect)
    .single();

  if (error) throw error;
  if (!data) throw new Error("Failed to update profile");

  return data as Profile;
}

export async function completeOnboarding(input: SessionContext): Promise<Profile> {
  const authUser = await assertValidSession(input);

  if (!authUser.phone) {
    throw new Error("User profile is incomplete.");
  }

  await ensureProfileRow(authUser.id, authUser.phone);

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({ onboarding_completed: true })
    .eq("id", authUser.id)
    .select(profileSelect)
    .single();

  if (error) throw error;
  if (!data) throw new Error("Failed to complete onboarding");

  return data as Profile;
}