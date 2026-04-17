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
  user_journey_selection_shown: boolean;
};

const profileSelect =
  "id, phone, display_name, gender, age, avatar_url, date_of_birth, health_conditions, onboarding_completed, user_journey_selection_shown";

function normalizePhone(phone: string): string {
  return phone.trim().replace(/[^\d+]/g, "");
}

function isOnboardingComplete(profile: Profile): boolean {
  return !!(
    profile.display_name &&
    profile.gender &&
    profile.date_of_birth &&
    profile.health_conditions !== null
  );
}

async function updateOnboardingStatus(userId: string, profile: Profile): Promise<Profile> {
  const shouldBeComplete = isOnboardingComplete(profile);

  if (shouldBeComplete && !profile.onboarding_completed) {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .update({ onboarding_completed: true })
      .eq("id", userId)
      .select(profileSelect)
      .single();

    if (error) throw error;
    return data as Profile;
  }

  return profile;
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

  if (error) {
    console.error("Update display name error:", error);
    throw new Error(`Failed to update profile: ${error.message}`);
  }
  if (!data) throw new Error("Failed to update profile: No data returned");

  const profile = data as Profile;
  return await updateOnboardingStatus(authUser.id, profile);
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

export async function saveGender(input: {
  userId: string;
  sessionToken: string;
  gender: string;
}): Promise<Profile> {
  const authUser = await assertValidSession({
    userId: input.userId,
    sessionToken: input.sessionToken,
  });

  const genderInput = String(input.gender).trim().toLowerCase();

  const validGenders = ["male", "female", "other", "prefer not to say"];
  if (!validGenders.includes(genderInput)) {
    throw new Error(
      `Invalid gender value. Must be one of: ${validGenders.join(", ")}`
    );
  }

  if (!authUser.phone) {
    throw new Error("User profile is incomplete.");
  }

  await ensureProfileRow(authUser.id, authUser.phone);

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({ gender: genderInput })
    .eq("id", authUser.id)
    .select(profileSelect)
    .single();

  if (error) {
    console.error("Save gender error:", error);
    throw new Error(`Failed to save gender: ${error.message}`);
  }
  if (!data) throw new Error("Failed to save gender: No data returned");

  const profile = data as Profile;
  return await updateOnboardingStatus(authUser.id, profile);
}

export async function saveRoutineTimes(input: {
  userId: string;
  sessionToken: string;
  routineTimes: string[];
}): Promise<Profile> {
  const authUser = await assertValidSession({
    userId: input.userId,
    sessionToken: input.sessionToken,
  });

  const routineTimes = input.routineTimes;

  if (!Array.isArray(routineTimes) || routineTimes.length === 0) {
    throw new Error("Routine times are required");
  }

  const validTimes = ["morning", "afternoon", "evening", "night"];
  for (const time of routineTimes) {
    if (!validTimes.includes(String(time).toLowerCase())) {
      throw new Error(`Invalid routine time: ${time}`);
    }
  }

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
  if (!data) throw new Error("Failed to save routine times");

  return data as Profile;
}

export async function saveDateOfBirth(input: {
  userId: string;
  sessionToken: string;
  dateOfBirth: string;
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
    throw new Error("Future date not allowed");
  }

  if (!authUser.phone) {
    throw new Error("User profile is incomplete.");
  }

  await ensureProfileRow(authUser.id, authUser.phone);

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({ date_of_birth: dateOfBirth })
    .eq("id", authUser.id)
    .select(profileSelect)
    .single();

  if (error) {
    console.error("Date of birth update error:", error);
    throw new Error(`Failed to save date of birth: ${error.message}`);
  }
  if (!data) throw new Error("Failed to save date of birth: No data returned");

  const profile = data as Profile;
  return await updateOnboardingStatus(authUser.id, profile);
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

  if (error) {
    console.error("Save health conditions error:", error);
    throw new Error(`Failed to save health conditions: ${error.message}`);
  }
  if (!data) throw new Error("Failed to save health conditions: No data returned");

  const profile = data as Profile;
  return await updateOnboardingStatus(authUser.id, profile);
}

export async function markUserJourneySelectionShown(input: SessionContext): Promise<Profile> {
  const authUser = await assertValidSession(input);

  if (!authUser.phone) {
    throw new Error("User profile is incomplete.");
  }

  await ensureProfileRow(authUser.id, authUser.phone);

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({ user_journey_selection_shown: true })
    .eq("id", authUser.id)
    .select(profileSelect)
    .single();

  if (error) {
    console.error("Mark user journey shown error:", error);
    throw new Error(`Failed to update user journey status: ${error.message}`);
  }
  if (!data) throw new Error("Failed to update user journey status: No data returned");

  return data as Profile;
}