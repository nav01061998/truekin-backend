import type { FastifyInstance, FastifyRequest } from "fastify";
import { z, ZodError } from "zod";
import { sendEmailOTP, sendPhoneOTP, verifyEmailOTP, verifyPhoneOTP } from "../services/profile-otp-service.js";
import { logAuditEvent } from "../services/audit-service.js";
import { supabaseAdmin } from "../lib/supabase.js";

function readHeader(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return undefined;
}

function getAuthFromRequest(request: { headers: Record<string, unknown> }) {
  return {
    userId:
      readHeader(request.headers["x-user-id"]) ||
      readHeader(request.headers["X-User-Id"]),
    sessionToken:
      readHeader(request.headers["x-session-token"]) ||
      readHeader(request.headers["X-Session-Token"]),
  };
}

const sendEmailOTPSchema = z.object({
  email: z.string().email("Invalid email format"),
});

const verifyEmailOTPSchema = z.object({
  email: z.string().email("Invalid email format"),
  otp: z.string().min(4).max(6),
});

const sendPhoneOTPSchema = z.object({
  new_phone: z.string().min(10).max(15),
});

const verifyPhoneOTPSchema = z.object({
  new_phone: z.string().min(10).max(15),
  otp: z.string().min(4).max(6),
});

// Select exactly 17 fields as per spec
const profileSelect =
  "id, phone, email, email_verified, display_name, gender, avatar_url, date_of_birth, address, health_conditions, blood_group, height, weight, food_allergies, medicine_allergies, onboarding_completed, user_journey_selection_shown";

export async function registerOTPRoutes(app: FastifyInstance) {
  // Send Email OTP
  app.post("/v1/profile/email/send-otp", async (request, reply) => {
    try {
      const body = sendEmailOTPSchema.parse(request.body);
      const { userId, sessionToken } = getAuthFromRequest(request);

      if (!userId || !sessionToken) {
        return reply.code(401).send({
          success: false,
          error: "Unauthorized",
        });
      }

      const result = await sendEmailOTP({
        userId,
        sessionToken,
        email: body.email,
      });

      return {
        success: true,
        message: result.message,
        masked_email: result.masked_email,
      };
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.code(400).send({
          success: false,
          error: "Invalid request body",
          issues: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        });
      }

      console.error("Error sending email OTP:", error);
      const message = error instanceof Error ? error.message : "Failed to send OTP";
      return reply.code(400).send({
        success: false,
        error: message,
      });
    }
  });

  // Verify Email OTP
  app.post("/v1/profile/email/verify-otp", async (request: FastifyRequest, reply) => {
    const userId = (request.headers["x-user-id"] as string) || undefined;
    let auditLogged = false;

    try {
      const body = verifyEmailOTPSchema.parse(request.body);
      const { userId: authUserId, sessionToken } = getAuthFromRequest(request);

      if (!authUserId || !sessionToken) {
        return reply.code(401).send({
          success: false,
          error: "Unauthorized",
        });
      }

      await verifyEmailOTP({
        userId: authUserId,
        sessionToken,
        email: body.email,
        otp: body.otp,
      });

      // Log successful email verification
      await logAuditEvent({
        userId: authUserId,
        action: "EMAIL_VERIFICATION",
        status: "SUCCESS",
        newValue: { email: body.email, email_verified: true },
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"] as string,
      });
      auditLogged = true;

      // Fetch and return updated profile
      const { data: profile, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select(profileSelect)
        .eq("id", authUserId)
        .single();

      if (profileError || !profile) {
        throw new Error("Failed to fetch updated profile");
      }

      return {
        success: true,
        message: "Email verified successfully",
        profile,
      };
    } catch (error) {
      // Log failed attempt if not already logged
      if (!auditLogged && userId) {
        const message = error instanceof Error ? error.message : "Unknown error";
        await logAuditEvent({
          userId,
          action: "EMAIL_VERIFICATION",
          status: "FAILED",
          errorMessage: message,
          ipAddress: request.ip,
          userAgent: request.headers["user-agent"] as string,
        });
      }

      if (error instanceof ZodError) {
        return reply.code(400).send({
          success: false,
          error: "Invalid request body",
          issues: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        });
      }

      console.error("Error verifying email OTP:", error);
      const message = error instanceof Error ? error.message : "Failed to verify OTP";

      // Check for specific error conditions
      if (message.includes("Maximum OTP verification attempts exceeded")) {
        return reply.code(429).send({
          success: false,
          error: message,
        });
      }

      return reply.code(400).send({
        success: false,
        error: message,
      });
    }
  });

  // Send Phone OTP
  app.post("/v1/profile/phone/send-otp", async (request, reply) => {
    try {
      const body = sendPhoneOTPSchema.parse(request.body);
      const { userId, sessionToken } = getAuthFromRequest(request);

      if (!userId || !sessionToken) {
        return reply.code(401).send({
          success: false,
          error: "Unauthorized",
        });
      }

      const result = await sendPhoneOTP({
        userId,
        sessionToken,
        newPhone: body.new_phone,
      });

      return {
        success: true,
        message: result.message,
        masked_phone: result.masked_phone,
      };
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.code(400).send({
          success: false,
          error: "Invalid request body",
          issues: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        });
      }

      console.error("Error sending phone OTP:", error);
      const message = error instanceof Error ? error.message : "Failed to send OTP";
      return reply.code(400).send({
        success: false,
        error: message,
      });
    }
  });

  // Verify Phone OTP
  app.post("/v1/profile/phone/verify-otp", async (request: FastifyRequest, reply) => {
    const userId = (request.headers["x-user-id"] as string) || undefined;
    let auditLogged = false;

    try {
      const body = verifyPhoneOTPSchema.parse(request.body);
      const { userId: authUserId, sessionToken } = getAuthFromRequest(request);

      if (!authUserId || !sessionToken) {
        return reply.code(401).send({
          success: false,
          error: "Unauthorized",
        });
      }

      await verifyPhoneOTP({
        userId: authUserId,
        sessionToken,
        newPhone: body.new_phone,
        otp: body.otp,
      });

      // Log successful phone change
      await logAuditEvent({
        userId: authUserId,
        action: "PHONE_CHANGE",
        status: "SUCCESS",
        newValue: { phone: body.new_phone },
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"] as string,
      });
      auditLogged = true;

      // Fetch and return updated profile
      const { data: profile, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select(profileSelect)
        .eq("id", authUserId)
        .single();

      if (profileError || !profile) {
        throw new Error("Failed to fetch updated profile");
      }

      return {
        success: true,
        message: "Phone number updated successfully",
        profile,
      };
    } catch (error) {
      // Log failed attempt if not already logged
      if (!auditLogged && userId) {
        const message = error instanceof Error ? error.message : "Unknown error";
        await logAuditEvent({
          userId,
          action: "PHONE_CHANGE",
          status: "FAILED",
          errorMessage: message,
          ipAddress: request.ip,
          userAgent: request.headers["user-agent"] as string,
        });
      }

      if (error instanceof ZodError) {
        return reply.code(400).send({
          success: false,
          error: "Invalid request body",
          issues: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        });
      }

      console.error("Error verifying phone OTP:", error);
      const message = error instanceof Error ? error.message : "Failed to verify OTP";

      // Check for specific error conditions
      if (message.includes("Maximum OTP verification attempts exceeded")) {
        return reply.code(429).send({
          success: false,
          error: message,
        });
      }

      return reply.code(400).send({
        success: false,
        error: message,
      });
    }
  });
}
