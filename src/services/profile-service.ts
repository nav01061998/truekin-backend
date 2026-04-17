import { supabaseAdmin } from "../lib/supabase.js";
import { assertValidSession, type SessionContext } from "./session-service.js";

export type Profile = {
  id: string;
  phone: string;
  display_name: string | null;
  gender: string | null;
  age: number | null;
  avatar_url: string | null;
  date_of_birth: string | null;
  health_conditions: string[] | null;
  onboarding_completed: boolean;
};

const profileSelect =
  "id, phone, display_name, gender, age, avatar_url, date_of_birth, health_conditions, onboarding_completed";

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

export async function saveDateOfBirth(input: {
  userId: string;
  sessionToken: string;
  dateOfBirth: string;
  age: number;
}): Promise<Profile> {
  const authUser = await assertValidSession({
    userId: input.userId,
    sessionToken: input.sessionToken,
  });

  const dateOfBirth = input.dateOfBirth.trim();

  if (!dateOfBirth.match(/^\d{4}-\d{2}-\d{2}$/)) {
    throw new Error("Invalid date format. Use YYYY-MM-DD");
  }

  const dateObj = new Date(dateOfBirth);
  if (isNaN(dateObj.getTime())) {
    throw new Error("Invalid date of birth");
  }

  if (dateObj.getTime() > Date.now()) {
    throw new Error("Date of birth cannot be in the future");
  }

  const age = input.age;
  if (!Number.isInteger(age) || age < 1 || age > 150) {
    throw new Error("Age must be a valid number between 1 and 150");
  }

  if (!authUser.phone) {
    throw new Error("User profile is incomplete.");
  }

  await ensureProfileRow(authUser.id, authUser.phone);

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({ date_of_birth: dateOfBirth, age })
    .eq("id", authUser.id)
    .select(profileSelect)
    .single();

  if (error) throw error;
  if (!data) throw new Error("Failed to save date of birth");

  return data as Profile;
}

export async function saveHealthConditions(input: {
  userId: string;
  sessionToken: string;
  healthConditions: string[];
}): Promise<Profile> {
  const authUser = await assertValidSession({
    userId: input.userId,
    sessionToken: input.sessionToken,
  });

  const conditions = input.healthConditions;

  if (!Array.isArray(conditions) || conditions.length === 0) {
    throw new Error("Health conditions are required");
  }

  const sanitizedConditions = conditions
    .map((condition) => {
      const sanitized = String(condition).trim();
      if (sanitized.length === 0) {
        throw new Error("Health conditions cannot be empty");
      }
      if (sanitized.length > 100) {
        throw new Error("Health condition text is too long (max 100 characters)");
      }
      return sanitized;
    });

  if (!authUser.phone) {
    throw new Error("User profile is incomplete.");
  }

  await ensureProfileRow(authUser.id, authUser.phone);

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({ health_conditions: sanitizedConditions })
    .eq("id", authUser.id)
    .select(profileSelect)
    .single();

  if (error) throw error;
  if (!data) throw new Error("Failed to save health conditions");

  return data as Profile;
}