import { supabaseAdmin } from "../lib/supabase.js";
import crypto from "crypto";

/**
 * Authentication OTP Service
 * Handles phone-based OTP for login/signup
 */

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

  if (!isValidPhone(normalizedPhone)) {
    throw new Error("Invalid phone format. Must be 10 digits starting with 6-9");
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
