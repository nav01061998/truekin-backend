import { supabaseAdmin } from "../lib/supabase.js";
import { assertValidSession, type SessionContext } from "./session-service.js";
import { createHash } from "crypto";

// UserProfile is the exact 17-field type returned in all API responses
export type UserProfile = {
  id: string;
  phone: string;
  display_name: string | null;
  gender: string | null;
  date_of_birth: string | null;
  health_conditions: string[] | null;
  avatar_url: string | null;
  onboarding_completed: boolean;
  user_journey_selection_shown: boolean;
  email: string | null;
  email_verified: boolean;
  address: string | null;
  blood_group: string | null;
  height: number | null;
  weight: number | null;
  food_allergies: string[] | null;
  medicine_allergies: string[] | null;
};

// Internal type for database operations (includes fields not sent to frontend)
type ProfileInternal = UserProfile & {
  age?: number | null;
  completion_percentage?: number;
  created_at?: string;
  updated_at?: string;
};

const profileSelect =
  "id, phone, email, email_verified, display_name, gender, avatar_url, date_of_birth, address, health_conditions, blood_group, height, weight, food_allergies, medicine_allergies, onboarding_completed, user_journey_selection_shown";

function normalizePhone(phone: string): string {
  return phone.trim().replace(/[^\d+]/g, "");
}

/**
 * Convert internal profile to UserProfile (17 fields only)
 */
function toUserProfile(profile: any): UserProfile {
  return {
    id: profile.id,
    phone: profile.phone,
    display_name: profile.display_name || null,
    gender: profile.gender || null,
    date_of_birth: profile.date_of_birth || null,
    health_conditions: profile.health_conditions || null,
    avatar_url: profile.avatar_url || null,
    onboarding_completed: profile.onboarding_completed === true,
    user_journey_selection_shown: profile.user_journey_selection_shown === true,
    email: profile.email || null,
    email_verified: profile.email_verified === true,
    address: profile.address || null,
    blood_group: profile.blood_group || null,
    height: profile.height || null,
    weight: profile.weight || null,
    food_allergies: profile.food_allergies || null,
    medicine_allergies: profile.medicine_allergies || null,
  };
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

function isOnboardingComplete(profile: UserProfile): boolean {
  return !!(
    profile.display_name &&
    profile.gender &&
    profile.date_of_birth &&
    profile.health_conditions !== null
  );
}

async function updateOnboardingStatus(userId: string, profile: UserProfile): Promise<UserProfile> {
  const shouldBeComplete = isOnboardingComplete(profile);

  if (shouldBeComplete && !profile.onboarding_completed) {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .update({ onboarding_completed: true })
      .eq("id", userId)
      .select(profileSelect)
      .single();

    if (error) throw error;
    return toUserProfile(data);
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
): Promise<UserProfile> {
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

  return toUserProfile(data);
}

export async function updateDisplayName(input: {
  userId: string;
  sessionToken: string;
  displayName: string;
}): Promise<UserProfile> {
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

  const profile = toUserProfile(data);
  return await updateOnboardingStatus(authUser.id, profile);
}

export async function completeOnboarding(input: SessionContext): Promise<UserProfile> {
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

  return toUserProfile(data);
}

export async function saveGender(input: {
  userId: string;
  sessionToken: string;
  gender: string;
}): Promise<UserProfile> {
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

  const profile = toUserProfile(data);
  return await updateOnboardingStatus(authUser.id, profile);
}

export async function saveRoutineTimes(input: {
  userId: string;
  sessionToken: string;
  routineTimes: string[];
}): Promise<UserProfile> {
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

  return toUserProfile(data);
}

export async function saveDateOfBirth(input: {
  userId: string;
  sessionToken: string;
  dateOfBirth: string;
}): Promise<UserProfile> {
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

  const profile = toUserProfile(data);
  return await updateOnboardingStatus(authUser.id, profile);
}

export async function saveHealthConditions(input: {
  userId: string;
  sessionToken: string;
  healthConditions: string[];
}): Promise<UserProfile> {
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

  const profile = toUserProfile(data);
  return await updateOnboardingStatus(authUser.id, profile);
}

export async function markUserJourneySelectionShown(input: SessionContext): Promise<UserProfile> {
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

  return toUserProfile(data);
}

/**
 * Save address to profile
 */
export async function saveAddress(input: {
  userId: string;
  sessionToken: string;
  address: string;
}): Promise<UserProfile> {
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

  return toUserProfile(data);
}

/**
 * Save blood group to profile
 */
export async function saveBloodGroup(input: {
  userId: string;
  sessionToken: string;
  bloodGroup: string;
}): Promise<UserProfile> {
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

  return toUserProfile(data);
}

/**
 * Save height to profile
 */
export async function saveHeight(input: {
  userId: string;
  sessionToken: string;
  height: number;
}): Promise<UserProfile> {
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

  return toUserProfile(data);
}

/**
 * Save weight to profile
 */
export async function saveWeight(input: {
  userId: string;
  sessionToken: string;
  weight: number;
}): Promise<UserProfile> {
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

  return toUserProfile(data);
}

/**
 * Save food allergies to profile
 */
export async function saveFoodAllergies(input: {
  userId: string;
  sessionToken: string;
  foodAllergies: string[];
}): Promise<UserProfile> {
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

  return toUserProfile(data);
}

/**
 * Save medicine allergies to profile
 */
export async function saveMedicineAllergies(input: {
  userId: string;
  sessionToken: string;
  medicineAllergies: string[];
}): Promise<UserProfile> {
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

  return toUserProfile(data);
}

/**
 * Update user profile with multiple fields and calculate completion percentage
 * Returns both the updated profile and completion percentage
 */
export async function updateUserProfile(input: {
  userId: string;
  sessionToken: string;
  displayName?: string;
  gender?: string;
  email?: string;
  phone?: string;
  address?: string;
  healthConditions?: string[];
  bloodGroup?: string;
  height?: number;
  weight?: number;
  foodAllergies?: string[];
  medicineAllergies?: string[];
}): Promise<{ profile: UserProfile; completion_percentage: number }> {
  const authUser = await assertValidSession({
    userId: input.userId,
    sessionToken: input.sessionToken,
  });

  // Build update object with only provided fields
  const updateData: any = {};

  if (input.displayName !== undefined) {
    const displayName = input.displayName.replace(/\s+/g, " ").trim();
    if (displayName.length < 1) throw new Error("Display name cannot be empty");
    if (displayName.length > 50) throw new Error("Display name too long");
    if (/[\u0000-\u001F\u007F]/.test(displayName)) throw new Error("Invalid characters in name");
    updateData.display_name = displayName;
  }

  if (input.gender !== undefined) {
    const validGenders = ["male", "female", "other", "prefer not to say"];
    if (!validGenders.includes(input.gender)) {
      throw new Error(`Invalid gender. Must be one of: ${validGenders.join(", ")}`);
    }
    updateData.gender = input.gender;
  }

  if (input.email !== undefined) {
    if (!input.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      throw new Error("Invalid email format");
    }
    updateData.email = input.email;
  }

  if (input.phone !== undefined) {
    const normalized = input.phone.replace(/\D/g, "");
    updateData.phone = normalized;
  }

  if (input.address !== undefined) {
    if (input.address.length < 10) throw new Error("Address must be at least 10 characters");
    if (input.address.length > 200) throw new Error("Address cannot exceed 200 characters");
    updateData.address = input.address.trim();
  }

  if (input.healthConditions !== undefined) {
    if (Array.isArray(input.healthConditions) && input.healthConditions.length > 0) {
      const sanitized = input.healthConditions
        .map((c) => String(c).trim())
        .filter((c) => c.length > 0);
      if (sanitized.length > 0) {
        updateData.health_conditions = sanitized;
      }
    }
  }

  if (input.bloodGroup !== undefined) {
    const validBloodGroups = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];
    const bloodGroup = String(input.bloodGroup).trim().toUpperCase();
    if (!validBloodGroups.includes(bloodGroup)) {
      throw new Error(`Invalid blood group. Must be one of: ${validBloodGroups.join(", ")}`);
    }
    updateData.blood_group = bloodGroup;
  }

  if (input.height !== undefined) {
    if (input.height < 100 || input.height > 250) {
      throw new Error("Height must be between 100 and 250 cm");
    }
    updateData.height = input.height;
  }

  if (input.weight !== undefined) {
    if (input.weight < 20 || input.weight > 250) {
      throw new Error("Weight must be between 20 and 250 kg");
    }
    updateData.weight = input.weight;
  }

  if (input.foodAllergies !== undefined) {
    if (Array.isArray(input.foodAllergies) && input.foodAllergies.length > 0) {
      const sanitized = input.foodAllergies
        .map((a) => String(a).trim())
        .filter((a) => a.length > 0);
      if (sanitized.length > 0) {
        updateData.food_allergies = sanitized;
      }
    }
  }

  if (input.medicineAllergies !== undefined) {
    if (Array.isArray(input.medicineAllergies) && input.medicineAllergies.length > 0) {
      const sanitized = input.medicineAllergies
        .map((a) => String(a).trim())
        .filter((a) => a.length > 0);
      if (sanitized.length > 0) {
        updateData.medicine_allergies = sanitized;
      }
    }
  }

  // If no fields to update, return current profile
  if (Object.keys(updateData).length === 0) {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select(profileSelect)
      .eq("id", authUser.id)
      .single();

    if (error || !data) throw new Error("Failed to fetch profile");

    const profile = toUserProfile(data);
    const completion = calculateCompletionPercentage(data);
    return { profile, completion_percentage: completion };
  }

  await ensureProfileRow(authUser.id, authUser.phone || "");

  // Update profile
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update(updateData)
    .eq("id", authUser.id)
    .select(profileSelect)
    .single();

  if (error) {
    console.error("Update profile error:", error);
    throw new Error(`Failed to update profile: ${error.message}`);
  }
  if (!data) throw new Error("Failed to update profile: No data returned");

  const profile = toUserProfile(data);
  const completion_percentage = calculateCompletionPercentage(data);

  // Update onboarding status if needed
  const updated = await updateOnboardingStatus(authUser.id, profile);

  return {
    profile: updated,
    completion_percentage,
  };
}

/**
 * Upload and store user avatar, update profile with avatar_url
 * Image is stored in Supabase Storage under profileImageUrl bucket
 */
export async function uploadAvatar(input: {
  userId: string;
  sessionToken: string;
  imageData: string;
  imageFormat: "jpeg" | "png" | "webp";
}): Promise<{ profile: UserProfile; completion_percentage: number }> {
  const authUser = await assertValidSession({
    userId: input.userId,
    sessionToken: input.sessionToken,
  });

  // Validate image format
  const validFormats = ["jpeg", "png", "webp"];
  if (!validFormats.includes(input.imageFormat)) {
    throw new Error("Unsupported image format. Must be jpeg, png, or webp");
  }

  // Decode base64 to buffer
  let imageBuffer: Buffer;
  try {
    imageBuffer = Buffer.from(input.imageData, "base64");
  } catch (error) {
    throw new Error("Invalid base64 image data");
  }

  // Validate image size (5MB max)
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (imageBuffer.length > maxSize) {
    throw new Error("Image file is too large (max 5MB uncompressed)");
  }

  // Validate image by checking magic bytes (file signatures)
  const magicBytes = imageBuffer.slice(0, 12);
  const isJpeg = magicBytes[0] === 0xff && magicBytes[1] === 0xd8 && magicBytes[2] === 0xff;
  const isPng =
    magicBytes[0] === 0x89 &&
    magicBytes[1] === 0x50 &&
    magicBytes[2] === 0x4e &&
    magicBytes[3] === 0x47;
  const isWebp =
    magicBytes[0] === 0x52 &&
    magicBytes[1] === 0x49 &&
    magicBytes[2] === 0x46 &&
    magicBytes[3] === 0x46 &&
    magicBytes[8] === 0x57 &&
    magicBytes[9] === 0x45 &&
    magicBytes[10] === 0x42 &&
    magicBytes[11] === 0x50;

  // Validate format matches magic bytes
  if (input.imageFormat === "jpeg" && !isJpeg) {
    throw new Error("Invalid JPEG file format");
  }
  if (input.imageFormat === "png" && !isPng) {
    throw new Error("Invalid PNG file format");
  }
  if (input.imageFormat === "webp" && !isWebp) {
    throw new Error("Invalid WebP file format");
  }

  // Generate unique filename using user ID and hash of image
  const imageHash = createHash("md5").update(imageBuffer).digest("hex");
  const fileExtension = input.imageFormat === "jpeg" ? "jpg" : input.imageFormat;
  const filename = `${authUser.id}-${imageHash}.${fileExtension}`;

  // Upload to Supabase Storage
  const { error: uploadError } = await supabaseAdmin.storage
    .from("profileImageUrl")
    .upload(`avatars/${filename}`, imageBuffer, {
      contentType: `image/${input.imageFormat === "jpeg" ? "jpeg" : input.imageFormat}`,
      upsert: true, // Replace if exists
    });

  if (uploadError) {
    console.error("Avatar upload error:", uploadError);
    throw new Error(`Failed to upload avatar: ${uploadError.message}`);
  }

  // Get public URL from storage
  const { data: publicUrlData } = supabaseAdmin.storage
    .from("profileImageUrl")
    .getPublicUrl(`avatars/${filename}`);

  const avatarUrl = publicUrlData.publicUrl;

  // Update profile with avatar_url
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", authUser.id)
    .select(profileSelect)
    .single();

  if (error) {
    console.error("Failed to update profile with avatar_url:", error);
    throw new Error(`Failed to update profile: ${error.message}`);
  }
  if (!data) throw new Error("Failed to update profile: No data returned");

  const profile = toUserProfile(data);
  const completion_percentage = calculateCompletionPercentage(data);

  return {
    profile,
    completion_percentage,
  };
}