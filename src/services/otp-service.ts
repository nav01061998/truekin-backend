import { supabaseAdmin } from "../lib/supabase.js";
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
 */
const BYPASS_PHONE = "8547032018";

function hashOTP(otp: string): string {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function isValidPhone(phone: string): boolean {
  const phoneRegex = /^[6-9]\d{9}$/;
  return phoneRegex.test(phone.replace(/\D/g, ""));
}

export async function sendOtp(phone: string): Promise<{
  success: boolean;
  message: string;
}> {
  const normalizedPhone = phone.replace(/\D/g, "");
  console.log(`[OTP] Received request to send OTP to phone: ${normalizedPhone}`);
  if (!isValidPhone(normalizedPhone)) {
    throw new Error("Invalid phone format. Must be 10 digits starting with 6-9");
  }

  // BYPASS: Allow test phone to skip OTP storage
  if (normalizedPhone === BYPASS_PHONE) {
    console.log(`[OTP BYPASS] Test phone ${normalizedPhone} - OTP bypassed, any code will work`);
    return {
      success: true,
      message: "OTP sent to your phone (test mode - bypass enabled)",
    };
  }

  const otp = generateOTP();
  const hashedOTP = hashOTP(otp);
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 10);

  // Store OTP in otp_sessions table (from migration 003)
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
  isNewUser: boolean;
  tokenHash: string;
  bypass: boolean;
  user: any;
}> {
  const normalizedPhone = data.phone.replace(/\D/g, "");
  const otp = data.otp.trim();

  if (!isValidPhone(normalizedPhone)) {
    throw new Error("Invalid phone format");
  }

  // BYPASS: Test phone accepts any 6-digit OTP
  if (normalizedPhone === BYPASS_PHONE) {
    if (!/^\d{6}$/.test(otp)) {
      throw new Error("Please enter a valid 6-digit OTP");
    }

    console.log(`[OTP BYPASS] Verifying test phone ${normalizedPhone} with OTP: ${otp} (bypass mode)`);

    // Check if user already exists in auth
    const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingAuthUser = authUsers?.users?.find((u: any) => u.phone === normalizedPhone);

    let userId: string;
    let isNewUser = false;
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
      isNewUser = true;
    }

    // Check if profile exists
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, phone")
      .eq("id", userId)
      .single();

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

    // Generate session token
    const tokenHash = crypto.randomBytes(32).toString("hex");

    return {
      userId,
      isNewUser,
      tokenHash,
      bypass: true,
      user: existingProfile || { phone: normalizedPhone, email },
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
  const { data: existingUser } = await supabaseAdmin
    .from("profiles")
    .select("id, phone")
    .eq("phone", normalizedPhone)
    .single();

  const isNewUser = !existingUser;

  // For new users, create profile
  if (isNewUser) {
    const { error: createError } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: crypto.randomUUID(),
        phone: normalizedPhone,
      });

    if (createError) {
      console.error("Error creating profile:", createError);
      throw new Error("Failed to create user profile");
    }
  }

  // Generate session token
  const tokenHash = crypto.randomBytes(32).toString("hex");

  return {
    userId: existingUser?.id || crypto.randomUUID(),
    isNewUser,
    tokenHash,
    bypass: false,
    user: existingUser || { phone: normalizedPhone },
  };
}
