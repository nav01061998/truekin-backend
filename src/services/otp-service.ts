import crypto from "node:crypto";
import { env } from "../config/env.js";
import { supabaseAdmin } from "../lib/supabase.js";

const BYPASS_PHONE = "+918547032018";
const MAX_ATTEMPTS = 5;

function phoneAliasEmail(phone: string) {
  return `${phone.replace(/\D/g, "")}@phone.truekin.app`;
}

async function hashOtp(otp: string) {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

async function createAuthArtifact(phone: string) {
  const aliasEmail = phoneAliasEmail(phone);
  const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
  const existingUser = existingUsers.users.find((user) => user.phone === phone);

  let userId: string;
  let isNewUser = false;
  let loginEmail = existingUser?.email || aliasEmail;

  if (existingUser) {
    userId = existingUser.id;
    const updates: {
      phone: string;
      phone_confirm: true;
      email?: string;
      email_confirm?: true;
    } = {
      phone,
      phone_confirm: true,
    };

    if (!existingUser.email) {
      updates.email = aliasEmail;
      updates.email_confirm = true;
      loginEmail = aliasEmail;
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      updates
    );
    if (error) throw error;
  } else {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      phone,
      phone_confirm: true,
      email: aliasEmail,
      email_confirm: true,
      user_metadata: { phone_alias_email: aliasEmail },
    });

    if (error || !data.user) throw error || new Error("Failed to create user");
    userId = data.user.id;
    isNewUser = true;
    loginEmail = data.user.email || aliasEmail;
  }

  const { data: linkData, error: linkError } =
    await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: loginEmail,
    });

  if (linkError || !linkData?.properties?.hashed_token) {
    throw linkError || new Error("Failed to generate login artifact");
  }

  return {
    userId,
    isNewUser,
    tokenHash: linkData.properties.hashed_token,
    bypass: phone === BYPASS_PHONE,
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
  if (phone === BYPASS_PHONE) {
    return {
      success: true,
      provider: "bypass",
      message: "Test mode - any OTP will work",
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

  const sendResult = phone.startsWith("+91")
    ? await sendViaMSG91(phone, otp)
    : await sendViaTwilio(phone, otp);

  if (!sendResult.success) {
    throw new Error(sendResult.error || "Failed to send OTP");
  }

  return {
    success: true,
    provider: phone.startsWith("+91") ? "msg91" : "twilio",
    message: "OTP sent successfully",
  };
}

export async function verifyOtp(input: { phone: string; otp: string }) {
  const { phone, otp } = input;

  if (phone === BYPASS_PHONE && otp.length === 6) {
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
