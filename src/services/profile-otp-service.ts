import { supabaseAdmin } from "../lib/supabase.js";
import { assertValidSession, type SessionContext } from "./session-service.js";
import crypto from "crypto";

export type OTPType = "EMAIL_VERIFICATION" | "PHONE_CHANGE";

export interface SendOTPInput extends SessionContext {
  email?: string;
  newPhone?: string;
}

export interface VerifyOTPInput extends SessionContext {
  email?: string;
  newPhone?: string;
  otp: string;
}

/**
 * Hash OTP code for secure storage
 */
function hashOTP(otp: string): string {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

/**
 * Generate random 4-digit OTP
 */
function generateOTP(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone format (10 digits, starts with 6-9)
 */
function isValidPhone(phone: string): boolean {
  const phoneRegex = /^[6-9]\d{9}$/;
  return phoneRegex.test(phone.replace(/\D/g, ""));
}

/**
 * Send OTP to email
 */
export async function sendEmailOTP(input: SendOTPInput & { email: string }): Promise<{
  success: boolean;
  message: string;
  masked_email: string;
}> {
  const authUser = await assertValidSession({
    userId: input.userId,
    sessionToken: input.sessionToken,
  });

  const email = input.email.trim().toLowerCase();

  // Validate email format
  if (!isValidEmail(email)) {
    throw new Error("Invalid email format");
  }

  // Check if email is already verified by another user
  const { data: existingEmail } = await supabaseAdmin
    .from("profiles")
    .select("id, email_verified")
    .eq("email", email)
    .neq("id", authUser.id)
    .single();

  if (existingEmail && existingEmail.email_verified) {
    throw new Error("Email already verified by another user");
  }

  // Check rate limiting: max 3 active OTP requests at a time
  const { data: activeOTPs } = await supabaseAdmin
    .from("otp_requests")
    .select("id")
    .eq("user_id", authUser.id)
    .eq("is_verified", false)
    .gt("expires_at", new Date().toISOString());

  if (activeOTPs && activeOTPs.length >= 3) {
    throw new Error("Maximum active OTP requests reached. Please try again later");
  }

  // Check resend rate limiting: minimum 30 seconds between resends
  const { data: recentOTP } = await supabaseAdmin
    .from("otp_requests")
    .select("created_at")
    .eq("user_id", authUser.id)
    .eq("email", email)
    .eq("type", "EMAIL_VERIFICATION")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (recentOTP) {
    const createdAt = new Date(recentOTP.created_at);
    const now = new Date();
    const secondsSinceLastOTP = (now.getTime() - createdAt.getTime()) / 1000;

    if (secondsSinceLastOTP < 30) {
      throw new Error(`Please wait ${Math.ceil(30 - secondsSinceLastOTP)} seconds before retrying`);
    }
  }

  // Generate OTP
  const otp = generateOTP();
  const hashedOTP = hashOTP(otp);
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 10); // 10 minutes expiry

  // Store OTP in database
  const { error: otpError } = await supabaseAdmin.from("otp_requests").insert({
    user_id: authUser.id,
    email,
    type: "EMAIL_VERIFICATION",
    otp_code: hashedOTP,
    expires_at: expiresAt.toISOString(),
    attempt_count: 0,
    max_attempts: 5,
    is_verified: false,
  });

  if (otpError) {
    console.error("Error creating OTP request:", otpError);
    throw new Error(`Failed to send OTP: ${otpError.message}`);
  }

  // TODO: Send OTP via email service (SMS91, AWS SES, etc.)
  console.log(`[OTP] Email OTP for ${email}: ${otp}`);

  // Mask email for response
  const maskedEmail = email.replace(/(.{1})(.*)(@.*)/, "$1***$3");

  return {
    success: true,
    message: "OTP sent to your email address",
    masked_email: maskedEmail,
  };
}

/**
 * Send OTP to phone for phone number change
 */
export async function sendPhoneOTP(input: SendOTPInput & { newPhone: string }): Promise<{
  success: boolean;
  message: string;
  masked_phone: string;
}> {
  const authUser = await assertValidSession({
    userId: input.userId,
    sessionToken: input.sessionToken,
  });

  const newPhone = input.newPhone.replace(/\D/g, "");

  // Validate phone format
  if (!isValidPhone(newPhone)) {
    throw new Error("Invalid phone format. Must be 10 digits starting with 6-9");
  }

  // Check if phone is already in system
  const { data: existingPhone } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("phone", newPhone)
    .neq("id", authUser.id)
    .single();

  if (existingPhone) {
    throw new Error("Phone number already registered to another user");
  }

  // Cannot change to same phone
  const { data: currentProfile } = await supabaseAdmin
    .from("profiles")
    .select("phone")
    .eq("id", authUser.id)
    .single();

  if (currentProfile?.phone === newPhone) {
    throw new Error("New phone must be different from current phone");
  }

  // Check rate limiting: max 3 active OTP requests at a time
  const { data: activeOTPs } = await supabaseAdmin
    .from("otp_requests")
    .select("id")
    .eq("user_id", authUser.id)
    .eq("is_verified", false)
    .gt("expires_at", new Date().toISOString());

  if (activeOTPs && activeOTPs.length >= 3) {
    throw new Error("Maximum active OTP requests reached. Please try again later");
  }

  // Check resend rate limiting: minimum 30 seconds between resends
  const { data: recentOTP } = await supabaseAdmin
    .from("otp_requests")
    .select("created_at")
    .eq("user_id", authUser.id)
    .eq("phone", newPhone)
    .eq("type", "PHONE_CHANGE")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (recentOTP) {
    const createdAt = new Date(recentOTP.created_at);
    const now = new Date();
    const secondsSinceLastOTP = (now.getTime() - createdAt.getTime()) / 1000;

    if (secondsSinceLastOTP < 30) {
      throw new Error(`Please wait ${Math.ceil(30 - secondsSinceLastOTP)} seconds before retrying`);
    }
  }

  // Generate OTP
  const otp = generateOTP();
  const hashedOTP = hashOTP(otp);
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 10); // 10 minutes expiry

  // Store OTP in database
  const { error: otpError } = await supabaseAdmin.from("otp_requests").insert({
    user_id: authUser.id,
    phone: newPhone,
    type: "PHONE_CHANGE",
    otp_code: hashedOTP,
    expires_at: expiresAt.toISOString(),
    attempt_count: 0,
    max_attempts: 5,
    is_verified: false,
  });

  if (otpError) {
    console.error("Error creating OTP request:", otpError);
    throw new Error(`Failed to send OTP: ${otpError.message}`);
  }

  // TODO: Send OTP via SMS service (Twilio, MSG91, etc.)
  console.log(`[OTP] Phone OTP for ${newPhone}: ${otp}`);

  // Mask phone for response (show only last 2 digits)
  const maskedPhone = newPhone.replace(/(\d{4})(\d{4})(\d{2})/, "$1****$3");

  return {
    success: true,
    message: "OTP sent to your phone number",
    masked_phone: maskedPhone,
  };
}

/**
 * Verify email OTP and mark email as verified
 */
export async function verifyEmailOTP(input: VerifyOTPInput & { email: string }): Promise<void> {
  const authUser = await assertValidSession({
    userId: input.userId,
    sessionToken: input.sessionToken,
  });

  const email = input.email.trim().toLowerCase();
  const otp = input.otp.trim();

  if (!otp) {
    throw new Error("OTP is required");
  }

  // Get OTP request
  const { data: otpRequest, error: otpError } = await supabaseAdmin
    .from("otp_requests")
    .select("*")
    .eq("user_id", authUser.id)
    .eq("email", email)
    .eq("type", "EMAIL_VERIFICATION")
    .eq("is_verified", false)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (otpError || !otpRequest) {
    throw new Error("No active OTP request found. Please request a new OTP");
  }

  // Check if max attempts exceeded
  if (otpRequest.attempt_count >= otpRequest.max_attempts) {
    throw new Error("Maximum OTP verification attempts exceeded. Please request a new OTP");
  }

  // Check if OTP is expired
  const expiresAt = new Date(otpRequest.expires_at);
  if (expiresAt < new Date()) {
    throw new Error("OTP has expired. Please request a new OTP");
  }

  // Verify OTP
  const hashedInputOTP = hashOTP(otp);
  if (hashedInputOTP !== otpRequest.otp_code) {
    // Increment attempt count
    await supabaseAdmin
      .from("otp_requests")
      .update({ attempt_count: otpRequest.attempt_count + 1 })
      .eq("id", otpRequest.id);

    const remainingAttempts = otpRequest.max_attempts - otpRequest.attempt_count - 1;
    throw new Error(`Invalid OTP. ${remainingAttempts} attempts remaining`);
  }

  // Mark OTP as verified
  await supabaseAdmin
    .from("otp_requests")
    .update({
      is_verified: true,
      verified_at: new Date().toISOString(),
    })
    .eq("id", otpRequest.id);

  // Update user profile to mark email as verified
  const { error: updateError } = await supabaseAdmin
    .from("profiles")
    .update({
      email,
      email_verified: true,
    })
    .eq("id", authUser.id);

  if (updateError) {
    console.error("Error updating email verification:", updateError);
    throw new Error(`Failed to verify email: ${updateError.message}`);
  }

  console.log(`[AUDIT] Email verified for user ${authUser.id}: ${email}`);
}

/**
 * Verify phone OTP and update phone number
 */
export async function verifyPhoneOTP(input: VerifyOTPInput & { newPhone: string }): Promise<void> {
  const authUser = await assertValidSession({
    userId: input.userId,
    sessionToken: input.sessionToken,
  });

  const newPhone = input.newPhone.replace(/\D/g, "");
  const otp = input.otp.trim();

  if (!otp) {
    throw new Error("OTP is required");
  }

  // Validate phone format
  if (!isValidPhone(newPhone)) {
    throw new Error("Invalid phone format");
  }

  // Get OTP request
  const { data: otpRequest, error: otpError } = await supabaseAdmin
    .from("otp_requests")
    .select("*")
    .eq("user_id", authUser.id)
    .eq("phone", newPhone)
    .eq("type", "PHONE_CHANGE")
    .eq("is_verified", false)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (otpError || !otpRequest) {
    throw new Error("No active OTP request found. Please request a new OTP");
  }

  // Check if max attempts exceeded
  if (otpRequest.attempt_count >= otpRequest.max_attempts) {
    throw new Error("Maximum OTP verification attempts exceeded. Please request a new OTP");
  }

  // Check if OTP is expired
  const expiresAt = new Date(otpRequest.expires_at);
  if (expiresAt < new Date()) {
    throw new Error("OTP has expired. Please request a new OTP");
  }

  // Verify OTP
  const hashedInputOTP = hashOTP(otp);
  if (hashedInputOTP !== otpRequest.otp_code) {
    // Increment attempt count
    await supabaseAdmin
      .from("otp_requests")
      .update({ attempt_count: otpRequest.attempt_count + 1 })
      .eq("id", otpRequest.id);

    const remainingAttempts = otpRequest.max_attempts - otpRequest.attempt_count - 1;
    throw new Error(`Invalid OTP. ${remainingAttempts} attempts remaining`);
  }

  // Mark OTP as verified
  await supabaseAdmin
    .from("otp_requests")
    .update({
      is_verified: true,
      verified_at: new Date().toISOString(),
    })
    .eq("id", otpRequest.id);

  // Update user profile with new phone
  const { error: updateError } = await supabaseAdmin
    .from("profiles")
    .update({
      phone: newPhone,
    })
    .eq("id", authUser.id);

  if (updateError) {
    console.error("Error updating phone number:", updateError);
    throw new Error(`Failed to update phone number: ${updateError.message}`);
  }

  console.log(`[AUDIT] Phone changed for user ${authUser.id}: from phone to ${newPhone}`);
}
