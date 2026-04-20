import { supabaseAdmin } from "../lib/supabase.js";
import { createSession } from "./session-service.js";
import crypto from "crypto";

/**
 * Authentication OTP Service
 * Handles phone-based OTP for login/signup
 *
 * BYPASS_PHONE: Test phone number that bypasses OTP verification
 * - sendOtp: Returns success without storing OTP (accepts any code)
 * - verifyOtp: Accepts any 6-digit code without database verification
 * - User is created/logged in normally with bypass flag set
 *
 * This allows testing the full auth flow without SMS delivery.
 * Format: 10 digits starting with 6-9 (e.g., 8547032018)
 * Accepts with or without country code: +918547032018
 */
const BYPASS_PHONE = "918547032018";

// Select profile columns - exactly 17 fields as per spec
const profileSelect =
  "id, phone, email, email_verified, display_name, gender, avatar_url, date_of_birth, address, health_conditions, blood_group, height, weight, food_allergies, medicine_allergies, onboarding_completed, user_journey_selection_shown";

function hashOTP(otp: string): string {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}


function isValidPhone(phone: string): boolean {
  const normalized = phone.replace(/\D/g, "");

  // Accept both formats:
  // 1. 10 digits starting with 6-9 (without country code): 8547032018
  // 2. 12 digits starting with 91 followed by 6-9 (with India country code): 918547032018
  const tenDigitRegex = /^[6-9]\d{9}$/;
  const twelveDigitRegex = /^91[6-9]\d{9}$/;

  return tenDigitRegex.test(normalized) || twelveDigitRegex.test(normalized);
}

export async function sendOtp(phone: string): Promise<{
  success: boolean;
  message: string;
}> {
  const normalizedPhone = phone.replace(/\D/g, "");
  if (normalizedPhone === BYPASS_PHONE) {
    return {
      success: true,
      message: "OTP sent to your phone (test mode - bypass enabled)",
    };
  }

  const otp = generateOTP();
  const hashedOTP = hashOTP(otp);
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 10);


  const { error } = await supabaseAdmin.from("otp_sessions").insert({
    phone_number: normalizedPhone,
    otp_hash: hashedOTP,
    created_at: new Date().toISOString(),
    expires_at: expiresAt.toISOString(),
    attempts: 0,
  });

  if (error) {
    console.error("Error storing OTP:", error);
    throw new Error(`Failed to send OTP: ${error.message}`);
  }

  // TODO: Send OTP via SMS (MSG91, Twilio, etc.)
  console.log(`[OTP] Auth OTP for ${normalizedPhone}: ${otp}`);

  return {
    success: true,
    message: "OTP sent to your phone",
  };
}

export async function verifyOtp(data: {
  phone: string;
  otp: string;
}): Promise<{
  userId: string;
  is_new_user: boolean;
  token_hash: string;
  user: any;
}> {
  const normalizedPhone = data.phone.replace(/\D/g, "");
  const otp = data.otp.trim();

  if (!isValidPhone(normalizedPhone)) {
    throw new Error("Invalid phone format");
  }

  // BYPASS: Test phone accepts any 6-digit OTP
  if (normalizedPhone === BYPASS_PHONE) {
    // Check if user already exists in auth
    const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingAuthUser = authUsers?.users?.find((u: any) => u.phone === normalizedPhone);

    let userId: string;
    let is_new_user = false;
    let email = existingAuthUser?.email;
    if (existingAuthUser) {
      userId = existingAuthUser.id;
      // Update existing user
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        {
          phone: normalizedPhone,
          phone_confirm: true,
        }
      );
      if (updateError) {
        console.error("Error updating auth user:", updateError);
        throw new Error("Failed to update user");
      }
    } else {
      // Create new auth user
      const aliasEmail = `${normalizedPhone}@phone.truekin.app`;
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        phone: normalizedPhone,
        phone_confirm: true,
        email: aliasEmail,
        email_confirm: true,
        user_metadata: { phone_alias_email: aliasEmail },
      });

      if (createError || !newUser?.user) {
        console.error("Error creating auth user:", createError);
        throw new Error("Failed to create user");
      }

      userId = newUser.user.id;
      email = newUser.user.email || aliasEmail;
      is_new_user = true;
    }
    // Check if profile exists
    const { data: existingProfile, error: profileFetchError } = await supabaseAdmin
      .from("profiles")
      .select(profileSelect)
      .eq("id", userId)
      .single();

    if (profileFetchError) {
      console.error("Error fetching profile for user:", userId, profileFetchError);
    }

    // Create profile if it doesn't exist
    if (!existingProfile) {
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .insert({
          id: userId,
          phone: normalizedPhone,
        });

      if (profileError) {
        console.error("Error creating profile:", profileError);
        throw new Error("Failed to create user profile");
      }
    }

    // Create session and get token
    const sessionToken = await createSession(userId);
    console.log("[OTP] Bypass: Session token created, length:", sessionToken.length, "token:", sessionToken);

    // Fetch the full profile to ensure we have all fields
    const { data: fullProfile } = await supabaseAdmin
      .from("profiles")
      .select(profileSelect)
      .eq("id", userId)
      .single();

    return {
      userId,
      is_new_user,
      token_hash: sessionToken,
      user: fullProfile || existingProfile || { id: userId, phone: normalizedPhone, email },
    };
  }

  // Get OTP session
  const { data: otpSession, error: otpError } = await supabaseAdmin
    .from("otp_sessions")
    .select("*")
    .eq("phone_number", normalizedPhone)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (otpError || !otpSession) {
    throw new Error("OTP expired or not found. Please request a new OTP");
  }

  // Check attempts
  if (otpSession.attempts >= 5) {
    throw new Error("Maximum attempts exceeded. Please request a new OTP");
  }

  // Verify OTP
  const hashedInputOTP = hashOTP(otp);
  if (hashedInputOTP !== otpSession.otp_hash) {
    // Increment attempts
    await supabaseAdmin
      .from("otp_sessions")
      .update({ attempts: otpSession.attempts + 1 })
      .eq("id", otpSession.id);

    throw new Error("Invalid OTP");
  }

  // Mark OTP as used
  await supabaseAdmin
    .from("otp_sessions")
    .update({ attempts: 999 })
    .eq("id", otpSession.id);

  // Check if user exists
  const { data: existingUser, error: userFetchError } = await supabaseAdmin
    .from("profiles")
    .select(profileSelect)
    .eq("phone", normalizedPhone)
    .single();

  if (userFetchError) {
    console.error("Error fetching user profile for phone:", normalizedPhone, userFetchError);
  }

  const is_new_user = !existingUser;
  let userId: string;

  // For new users, create profile
  if (is_new_user) {
    userId = crypto.randomUUID();
    const { error: createError } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: userId,
        phone: normalizedPhone,
      });

    if (createError) {
      console.error("Error creating profile:", createError);
      throw new Error("Failed to create user profile");
    }
  } else {
    userId = existingUser.id;
  }

  // Create session and get token
  const sessionToken = await createSession(userId);

  // Fetch the full profile to ensure we have all fields
  const { data: fullProfile } = await supabaseAdmin
    .from("profiles")
    .select(profileSelect)
    .eq("id", userId)
    .single();

  return {
    userId,
    is_new_user,
    token_hash: sessionToken,
    user: fullProfile || existingUser || { id: userId, phone: normalizedPhone },
  };
}
