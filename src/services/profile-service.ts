import { supabaseAdmin } from "../lib/supabase.js";
import { assertValidSession, type SessionContext } from "./session-service.js";

export type Profile = {
  id: string;
  phone: string;
  email: string | null;
  email_verified: boolean;
  display_name: string | null;
  gender: string | null;
  age: number | null;
  avatar_url: string | null;
  date_of_birth: string | null;
  address: string | null;
  health_conditions: string[] | null;
  blood_group: string | null;
  height: number | null;
  weight: number | null;
  food_allergies: string[] | null;
  medicine_allergies: string[] | null;
  onboarding_completed: boolean;
  user_journey_selection_shown: boolean;
  completion_percentage: number;
  created_at: string;
  updated_at: string;
};

const profileSelect =
  "id, phone, email, email_verified, display_name, gender, age, avatar_url, date_of_birth, address, health_conditions, blood_group, height, weight, food_allergies, medicine_allergies, onboarding_completed, user_journey_selection_shown, completion_percentage, created_at, updated_at";

function normalizePhone(phone: string): string {
  return phone.trim().replace(/[^\d+]/g, "");
}

/**
 * Calculate profile completion percentage
 *
 * Personal Information (50%):
 * - display_name: 10%
 * - gender: 10%
 * - date_of_birth: 10%
 * - email (verified): 10%
 * - address: 10%
 *
 * Health Information (50%):
 * - health_conditions: 10%
 * - blood_group: 10%
 * - height: 10%
 * - weight: 10%
 * - food_allergies OR medicine_allergies: 10%
 */
export function calculateCompletionPercentage(profile: any): number {
  let percentage = 0;

  // Personal Information (50%)
  if (profile.display_name?.trim()) percentage += 10;
  if (profile.gender) percentage += 10;
  if (profile.date_of_birth) percentage += 10;
  if (profile.email && profile.email_verified === true) percentage += 10;
  if (profile.address?.trim()?.length >= 10) percentage += 10;

  // Health Information (50%)
  if (Array.isArray(profile.health_conditions) && profile.health_conditions.length > 0)
    percentage += 10;
  if (profile.blood_group) percentage += 10;
  if (profile.height && profile.height > 100 && profile.height < 250) percentage += 10;
  if (profile.weight && profile.weight > 20 && profile.weight < 250) percentage += 10;
  if (
    (Array.isArray(profile.food_allergies) && profile.food_allergies.length > 0) ||
    (Array.isArray(profile.medicine_allergies) && profile.medicine_allergies.length > 0)
  ) {
    percentage += 10;
  }

  return Math.min(100, Math.max(0, percentage));
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
    const updatedProfile = data as Profile;
    updatedProfile.completion_percentage = calculateCompletionPercentage(updatedProfile);
    return updatedProfile;
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

  const profile = data as Profile;
  profile.completion_percentage = calculateCompletionPercentage(profile);
  return profile;
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
  profile.completion_percentage = calculateCompletionPercentage(profile);
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

  const profile = data as Profile;
  profile.completion_percentage = calculateCompletionPercentage(profile);
  return profile;
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
  profile.completion_percentage = calculateCompletionPercentage(profile);
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

  const profile = data as Profile;
  profile.completion_percentage = calculateCompletionPercentage(profile);
  return profile;
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
  profile.completion_percentage = calculateCompletionPercentage(profile);
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
  profile.completion_percentage = calculateCompletionPercentage(profile);
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

  const profile = data as Profile;
  profile.completion_percentage = calculateCompletionPercentage(profile);
  return profile;
}

/**
 * Save address to profile
 */
export async function saveAddress(input: {
  userId: string;
  sessionToken: string;
  address: string;
}): Promise<Profile> {
  const authUser = await assertValidSession({
    userId: input.userId,
    sessionToken: input.sessionToken,
  });

  const address = input.address.trim();

  if (address.length < 10) {
    throw new Error("Address must be at least 10 characters");
  }

  if (address.length > 200) {
    throw new Error("Address cannot exceed 200 characters");
  }

  await ensureProfileRow(authUser.id, authUser.phone || "");

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({ address })
    .eq("id", authUser.id)
    .select(profileSelect)
    .single();

  if (error) {
    console.error("Save address error:", error);
    throw new Error(`Failed to save address: ${error.message}`);
  }
  if (!data) throw new Error("Failed to save address: No data returned");

  const profile = data as Profile;
  profile.completion_percentage = calculateCompletionPercentage(profile);
  return profile;
}

/**
 * Save blood group to profile
 */
export async function saveBloodGroup(input: {
  userId: string;
  sessionToken: string;
  bloodGroup: string;
}): Promise<Profile> {
  const authUser = await assertValidSession({
    userId: input.userId,
    sessionToken: input.sessionToken,
  });

  const validBloodGroups = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];
  const bloodGroup = String(input.bloodGroup).trim().toUpperCase();

  if (!validBloodGroups.includes(bloodGroup)) {
    throw new Error(`Invalid blood group. Must be one of: ${validBloodGroups.join(", ")}`);
  }

  await ensureProfileRow(authUser.id, authUser.phone || "");

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({ blood_group: bloodGroup })
    .eq("id", authUser.id)
    .select(profileSelect)
    .single();

  if (error) {
    console.error("Save blood group error:", error);
    throw new Error(`Failed to save blood group: ${error.message}`);
  }
  if (!data) throw new Error("Failed to save blood group: No data returned");

  const profile = data as Profile;
  profile.completion_percentage = calculateCompletionPercentage(profile);
  return profile;
}

/**
 * Save height to profile
 */
export async function saveHeight(input: {
  userId: string;
  sessionToken: string;
  height: number;
}): Promise<Profile> {
  const authUser = await assertValidSession({
    userId: input.userId,
    sessionToken: input.sessionToken,
  });

  const height = Number(input.height);

  if (isNaN(height) || height <= 100 || height >= 250) {
    throw new Error("Height must be between 100 and 250 cm");
  }

  await ensureProfileRow(authUser.id, authUser.phone || "");

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({ height })
    .eq("id", authUser.id)
    .select(profileSelect)
    .single();

  if (error) {
    console.error("Save height error:", error);
    throw new Error(`Failed to save height: ${error.message}`);
  }
  if (!data) throw new Error("Failed to save height: No data returned");

  const profile = data as Profile;
  profile.completion_percentage = calculateCompletionPercentage(profile);
  return profile;
}

/**
 * Save weight to profile
 */
export async function saveWeight(input: {
  userId: string;
  sessionToken: string;
  weight: number;
}): Promise<Profile> {
  const authUser = await assertValidSession({
    userId: input.userId,
    sessionToken: input.sessionToken,
  });

  const weight = Number(input.weight);

  if (isNaN(weight) || weight <= 20 || weight >= 250) {
    throw new Error("Weight must be between 20 and 250 kg");
  }

  await ensureProfileRow(authUser.id, authUser.phone || "");

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({ weight })
    .eq("id", authUser.id)
    .select(profileSelect)
    .single();

  if (error) {
    console.error("Save weight error:", error);
    throw new Error(`Failed to save weight: ${error.message}`);
  }
  if (!data) throw new Error("Failed to save weight: No data returned");

  const profile = data as Profile;
  profile.completion_percentage = calculateCompletionPercentage(profile);
  return profile;
}

/**
 * Save food allergies to profile
 */
export async function saveFoodAllergies(input: {
  userId: string;
  sessionToken: string;
  foodAllergies: string[];
}): Promise<Profile> {
  const authUser = await assertValidSession({
    userId: input.userId,
    sessionToken: input.sessionToken,
  });

  const allergies = input.foodAllergies;

  if (!Array.isArray(allergies)) {
    throw new Error("Food allergies must be an array");
  }

  if (allergies.length > 10) {
    throw new Error("Cannot add more than 10 food allergies");
  }

  const sanitized = allergies
    .map((a) => String(a).trim())
    .filter((a) => a.length > 0);

  for (const allergy of sanitized) {
    if (allergy.length < 2 || allergy.length > 50) {
      throw new Error("Each allergy must be between 2 and 50 characters");
    }
  }

  await ensureProfileRow(authUser.id, authUser.phone || "");

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({ food_allergies: sanitized })
    .eq("id", authUser.id)
    .select(profileSelect)
    .single();

  if (error) {
    console.error("Save food allergies error:", error);
    throw new Error(`Failed to save food allergies: ${error.message}`);
  }
  if (!data) throw new Error("Failed to save food allergies: No data returned");

  const profile = data as Profile;
  profile.completion_percentage = calculateCompletionPercentage(profile);
  return profile;
}

/**
 * Save medicine allergies to profile
 */
export async function saveMedicineAllergies(input: {
  userId: string;
  sessionToken: string;
  medicineAllergies: string[];
}): Promise<Profile> {
  const authUser = await assertValidSession({
    userId: input.userId,
    sessionToken: input.sessionToken,
  });

  const allergies = input.medicineAllergies;

  if (!Array.isArray(allergies)) {
    throw new Error("Medicine allergies must be an array");
  }

  if (allergies.length > 10) {
    throw new Error("Cannot add more than 10 medicine allergies");
  }

  const sanitized = allergies
    .map((a) => String(a).trim())
    .filter((a) => a.length > 0);

  for (const allergy of sanitized) {
    if (allergy.length < 2 || allergy.length > 50) {
      throw new Error("Each allergy must be between 2 and 50 characters");
    }
  }

  await ensureProfileRow(authUser.id, authUser.phone || "");

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({ medicine_allergies: sanitized })
    .eq("id", authUser.id)
    .select(profileSelect)
    .single();

  if (error) {
    console.error("Save medicine allergies error:", error);
    throw new Error(`Failed to save medicine allergies: ${error.message}`);
  }
  if (!data) throw new Error("Failed to save medicine allergies: No data returned");

  const profile = data as Profile;
  profile.completion_percentage = calculateCompletionPercentage(profile);
  return profile;
}