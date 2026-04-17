import crypto from "node:crypto";
import { env } from "../config/env.js";
import { supabaseAdmin } from "../lib/supabase.js";

/**
 * BYPASS_PHONE: Test phone number that bypasses OTP verification
 * - sendOtp: Returns success without sending actual SMS
 * - verifyOtp: Accepts any 6-digit code without database verification
 * - User is created/logged in normally with bypass flag set
 * 
 * This allows testing the full auth flow without sending SMS.
 * Frontend should not show special UI for bypass users.
 */
const BYPASS_PHONE = "918547032018";
const MAX_ATTEMPTS = 5;
const SESSION_TTL_DAYS = 7;

async function hashOtp(otp: string) {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

type Profile = {
  id: string;
  phone: string;
  display_name: string | null;
  gender: string | null;
  age: number | null;
  avatar_url: string | null;
  onboarding_completed: boolean;
};

type AuthArtifactResult = {
  userId: string;
  isNewUser: boolean;
  tokenHash: string;
  bypass: boolean;
  user: Profile;
};

function normalizePhone(phone: string): string {
  return phone.trim().replace(/[^\d+]/g, "");
}

function phoneAliasEmail(phone: string): string {
  const normalized = normalizePhone(phone);
  const hash = crypto
    .createHash("sha256")
    .update(normalized)
    .digest("hex")
    .slice(0, 24);

  return `phone.${hash}@truekin.local`;
}

function isDuplicateUserError(error: unknown): boolean {
  const message =
    typeof error === "object" && error && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : String(error ?? "");

  return /already registered|duplicate|unique|conflict/i.test(message);
}

async function findAuthUserByPhone(phone: string) {
  const target = normalizePhone(phone);
  const perPage = 100;
  let page = 1;

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) throw error;

    const match = data.users.find(
      (user) => normalizePhone(user.phone ?? "") === target
    );

    if (match) return match;

    if (data.users.length < perPage) return null;

    page += 1;
  }
}

async function findAuthUserByEmail(email: string) {
  const target = email.trim().toLowerCase();
  const perPage = 100;
  let page = 1;

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) throw error;

    const match = data.users.find(
      (user) => (user.email ?? "").trim().toLowerCase() === target
    );

    if (match) return match;

    if (data.users.length < perPage) return null;

    page += 1;
  }
}

async function ensureProfileRow(userId: string, phone: string): Promise<Profile> {
  const normalizedPhone = normalizePhone(phone);

  const { error: upsertError } = await supabaseAdmin
    .from("profiles")
    .upsert(
      {
        id: userId,
        phone: normalizedPhone,
      },
      {
        onConflict: "id",
      }
    );

  if (upsertError) throw upsertError;

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select(
      "id, phone, display_name, gender, age, avatar_url, onboarding_completed"
    )
    .eq("id", userId)
    .single();

  if (profileError) throw profileError;
  if (!profile) throw new Error("Profile row could not be loaded");

  return profile as Profile;
}

async function ensureAuthUser(phone: string): Promise<{
  userId: string;
  isNewUser: boolean;
  loginEmail: string;
}> {
  const normalizedPhone = normalizePhone(phone);
  const aliasEmail = phoneAliasEmail(normalizedPhone);

  let existingUser = await findAuthUserByPhone(normalizedPhone);
  if (!existingUser) {
    existingUser = await findAuthUserByEmail(aliasEmail);
  }

  if (existingUser) {
    const userId = existingUser.id;
    const loginEmail = existingUser.email || aliasEmail;

    const updates: {
      phone: string;
      phone_confirm: true;
      email?: string;
      email_confirm?: true;
      user_metadata?: Record<string, unknown>;
    } = {
      phone: normalizedPhone,
      phone_confirm: true,
      user_metadata: {
        ...(existingUser.user_metadata ?? {}),
        phone_alias_email: aliasEmail,
      },
    };

    if (!existingUser.email) {
      updates.email = aliasEmail;
      updates.email_confirm = true;
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      updates
    );

    if (error) throw error;

    return {
      userId,
      isNewUser: false,
      loginEmail,
    };
  }

  try {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      phone: normalizedPhone,
      phone_confirm: true,
      email: aliasEmail,
      email_confirm: true,
      user_metadata: {
        phone_alias_email: aliasEmail,
      },
    });

    if (error || !data.user) throw error || new Error("Failed to create user");

    return {
      userId: data.user.id,
      isNewUser: true,
      loginEmail: data.user.email || aliasEmail,
    };
  } catch (error) {
    if (!isDuplicateUserError(error)) {
      throw error;
    }

    const fallbackUser =
      (await findAuthUserByPhone(normalizedPhone)) ||
      (await findAuthUserByEmail(aliasEmail));

    if (!fallbackUser) {
      throw error;
    }

    return {
      userId: fallbackUser.id,
      isNewUser: false,
      loginEmail: fallbackUser.email || aliasEmail,
    };
  }
}

export async function createAuthArtifact(phone: string): Promise<AuthArtifactResult> {
  const normalizedPhone = normalizePhone(phone);

  if (!normalizedPhone) {
    throw new Error("Phone number is required");
  }

  const aliasEmail = phoneAliasEmail(normalizedPhone);

  const { userId, isNewUser, loginEmail } = await ensureAuthUser(normalizedPhone);

  const { data: linkData, error: linkError } =
    await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: loginEmail,
    });

  if (linkError || !linkData?.properties?.hashed_token) {
    throw linkError || new Error("Failed to generate login artifact");
  }

  const tokenHash = linkData.properties.hashed_token;

  const user = await ensureProfileRow(userId, normalizedPhone);

  await createAuthSession(userId, tokenHash);

  return {
    userId,
    isNewUser,
    tokenHash: linkData.properties.hashed_token,
    bypass: normalizedPhone === normalizePhone(BYPASS_PHONE),
    user,
  };
}

async function sendViaMSG91(phone: string, otp: string) {
  if (!env.MSG91_AUTH_KEY || !env.MSG91_TEMPLATE_ID) {
    return { success: false, error: "MSG91 not configured. Please contact support." };
  }

  const response = await fetch("https://control.msg91.com/api/v5/otp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authkey: env.MSG91_AUTH_KEY,
    },
    body: JSON.stringify({
      template_id: env.MSG91_TEMPLATE_ID,
      mobile: phone.replace("+", ""),
      otp,
      sender: env.MSG91_SENDER_ID,
      otp_length: 6,
      otp_expiry: 10,
    }),
  });

  const data = await response.json();
  if (response.ok && data.type === "success") {
    return { success: true };
  }

  return { success: false, error: data.message || "MSG91 failed to deliver OTP" };
}

async function sendViaTwilio(phone: string, otp: string) {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_PHONE_NUMBER) {
    return { success: false, error: "Twilio not configured. Please contact support." };
  }

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(
          `${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`
        ).toString("base64")}`,
      },
      body: new URLSearchParams({
        To: phone,
        From: env.TWILIO_PHONE_NUMBER,
        Body: `Your TrueKin verification code is: ${otp}. Valid for 10 minutes.`,
      }),
    }
  );

  const data = await response.json();
  if (response.ok || response.status === 201) {
    return { success: true };
  }

  return { success: false, error: data.message || "Twilio failed to deliver OTP" };
}

export async function sendOtp(phone: string) {
  // Bypass phone for testing - accepts any 6-digit code without sending OTP
  if (phone === BYPASS_PHONE) {
    return {
      success: true,
      provider: phone.startsWith("91") ? "msg91" : "twilio",
      message: "OTP sent successfully",
    };
  }

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { error: dbError } = await supabaseAdmin.from("otp_sessions").upsert(
    {
      phone,
      otp_hash: await hashOtp(otp),
      expires_at: expiresAt,
      attempts: 0,
    },
    { onConflict: "phone" }
  );

  if (dbError) throw dbError;

  const sendResult = phone.startsWith("91")
    ? await sendViaMSG91(phone, otp)
    : await sendViaTwilio(phone, otp);

  if (!sendResult.success) {
    throw new Error(sendResult.error || "Failed to send OTP");
  }

  return {
    success: true,
    provider: phone.startsWith("91") ? "msg91" : "twilio",
    message: "OTP sent successfully",
  };
}

export async function verifyOtp(input: { phone: string; otp: string }) {
  const { phone, otp } = input;
  // Bypass phone for testing - accepts any 6-digit code without OTP verification
  if (phone === BYPASS_PHONE) {
    if (!otp || otp.length !== 6 || !/^\d{6}$/.test(otp)) {
      throw new Error("Incorrect code. Please check and try again.");
    }
    return createAuthArtifact(phone);
  }
  const { data: session, error: fetchError } = await supabaseAdmin
    .from("otp_sessions")
    .select("*")
    .eq("phone", phone)
    .single();

  if (fetchError || !session) {
    throw new Error("No OTP was requested for this number. Please request a new code.");
  }

  if (new Date(session.expires_at) < new Date()) {
    await supabaseAdmin.from("otp_sessions").delete().eq("phone", phone);
    throw new Error("This code has expired. Please request a new one.");
  }

  if (session.attempts >= MAX_ATTEMPTS) {
    await supabaseAdmin.from("otp_sessions").delete().eq("phone", phone);
    throw new Error("Too many incorrect attempts. Please request a new code.");
  }

  if ((await hashOtp(otp)) !== session.otp_hash) {
    await supabaseAdmin
      .from("otp_sessions")
      .update({ attempts: session.attempts + 1 })
      .eq("phone", phone);
    throw new Error("Incorrect code. Please check and try again.");
  }

  await supabaseAdmin.from("otp_sessions").delete().eq("phone", phone);
  return createAuthArtifact(phone);
}


async function createAuthSession(userId: string, sessionTokenHash: string) {
  const expiresAt = new Date(
    Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { error } = await supabaseAdmin.from("auth_sessions").upsert(
    {
      user_id: userId,
      session_token_hash: sessionTokenHash,
      expires_at: expiresAt,
      revoked_at: null,
    },
    {
      onConflict: "user_id,session_token_hash",
    }
  );

  if (error) throw error;
}