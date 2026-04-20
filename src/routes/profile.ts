import type { FastifyInstance } from "fastify";
import { z, ZodError } from "zod";
import {
  completeOnboarding,
  getCurrentUserProfile,
  updateDisplayName,
  markUserJourneySelectionShown,
  saveAddress,
  type UserProfile,
} from "../services/profile-service.js";
import { deleteUserAccount, type DeletionReason } from "../services/account-deletion-service.js";

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

const updateNameSchema = z.object({
  display_name: z.string().min(1).max(50),
});

const updateAddressSchema = z.object({
  address: z.string().min(1).max(200),
});

const deleteAccountSchema = z.object({
  reason: z.enum([
    "dont_want_to_use",
    "using_another_account",
    "too_many_notifications",
    "app_not_working",
    "other",
  ] as const),
});

export async function registerProfileRoutes(app: FastifyInstance) {
  app.get("/v1/profile/me", async (request, reply) => {
    try {
      const { userId, sessionToken } = getAuthFromRequest(request);
      if (!userId || !sessionToken) {
        return reply.code(401).send({
          error: "Invalid or expired session",
          message: "Please login again",
        });
      }

      const profile = await getCurrentUserProfile({
        userId,
        sessionToken,
      });

      // Return the 17-field profile directly (not wrapped)
      return profile;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load profile";

      // Handle different error types
      if (message.includes("Session revoked")) {
        return reply.code(403).send({
          error: "Session revoked",
          message: "Your session is no longer valid",
        });
      }

      if (message.includes("Session expired") || message.includes("Unauthorized")) {
        return reply.code(401).send({
          error: "Invalid or expired session",
          message: "Please login again",
        });
      }

      if (message.includes("User profile is incomplete")) {
        return reply.code(404).send({
          error: "User profile not found",
          message: "Profile data is incomplete",
        });
      }

      if (message.includes("Profile could not be loaded")) {
        return reply.code(404).send({
          error: "Profile not found",
          message: message,
        });
      }

      // Server error (keep cached data on client)
      return reply.code(500).send({
        error: "Server error",
        message: "Please try again later",
      });
    }
  });

  app.post("/v1/profile/update", async (request, reply) => {
    try {
      const body = updateNameSchema.parse(request.body);
      const { userId, sessionToken } = getAuthFromRequest(request);

      if (!userId || !sessionToken) {
        return reply.code(401).send({
          error: "Unauthorized",
        });
      }

      const profile = await updateDisplayName({
        userId,
        sessionToken,
        displayName: body.display_name,
      });

      // Return the 17-field profile directly
      return profile;
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.code(400).send({
          error: "Invalid request body",
        });
      }

      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Failed to update profile",
      });
    }
  });

  app.post("/v1/profile/address", async (request, reply) => {
    try {
      const body = updateAddressSchema.parse(request.body);
      const { userId, sessionToken } = getAuthFromRequest(request);

      if (!userId || !sessionToken) {
        return reply.code(401).send({
          error: "Unauthorized",
        });
      }

      const profile = await saveAddress({
        userId,
        sessionToken,
        address: body.address,
      });

      // Return the 17-field profile directly
      return profile;
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.code(400).send({
          error: "Invalid request body",
        });
      }

      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Failed to update address",
      });
    }
  });

  app.post("/v1/profile/complete-onboarding", async (request, reply) => {
    try {
      const { userId, sessionToken } = getAuthFromRequest(request);

      if (!userId || !sessionToken) {
        return reply.code(401).send({
          error: "Unauthorized",
        });
      }

      await completeOnboarding({
        userId,
        sessionToken,
      });

      return {
        success: true,
        message: "Onboarding completed",
      };
    } catch (error) {
      return reply.code(400).send({
        error:
          error instanceof Error ? error.message : "Failed to complete onboarding",
      });
    }
  });

  app.post("/v1/profile/mark-journey-shown", async (request, reply) => {
    try {
      const { userId, sessionToken } = getAuthFromRequest(request);

      if (!userId || !sessionToken) {
        return reply.code(401).send({
          success: false,
          error: "Unauthorized",
        });
      }

      const profile = await markUserJourneySelectionShown({
        userId,
        sessionToken,
      });

      return {
        success: true,
        message: "User journey selection marked as shown",
        profile,
      };
    } catch (error) {
      return reply.code(400).send({
        success: false,
        error: error instanceof Error ? error.message : "Failed to mark journey as shown",
      });
    }
  });

  app.post("/v1/profile/delete", async (request, reply) => {
    try {
      const body = deleteAccountSchema.parse(request.body);
      const { userId, sessionToken } = getAuthFromRequest(request);

      if (!userId || !sessionToken) {
        return reply.code(401).send({
          success: false,
          error: "Unauthorized",
        });
      }

      // Extract IP and user agent from request for audit log
      const ipAddress = request.ip;
      const userAgent = request.headers["user-agent"] as string | undefined;

      // Delete account
      await deleteUserAccount({
        userId,
        sessionToken,
        reason: body.reason as DeletionReason,
        ipAddress,
        userAgent,
      });

      return {
        success: true,
        message: "Account successfully deleted",
      };
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.code(400).send({
          error: "Invalid deletion reason",
        });
      }

      const message = error instanceof Error ? error.message : "Account deletion failed";

      // 401 for auth errors
      if (message.includes("Unauthorized") || message.includes("Invalid or expired session")) {
        return reply.code(401).send({
          error: message,
        });
      }

      return reply.code(400).send({
        error: message,
      });
    }
  });
}