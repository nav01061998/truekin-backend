import type { FastifyInstance } from "fastify";
import { z, ZodError } from "zod";
import {
  completeOnboarding,
  getCurrentUserProfile,
  updateDisplayName,
} from "../services/profile-service.js";

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

export async function registerProfileRoutes(app: FastifyInstance) {
  app.get("/v1/profile/me", async (request, reply) => {
    try {
      const { userId, sessionToken } = getAuthFromRequest(request);

      if (!userId || !sessionToken) {
        return reply.code(401).send({
          success: false,
          error: "Unauthorized",
        });
      }

      const profile = await getCurrentUserProfile({
        userId,
        sessionToken,
      });

      return {
        success: true,
        profile,
      };
    } catch (error) {
      return reply.code(400).send({
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to load profile",
      });
    }
  });

  app.post("/v1/profile/update", async (request, reply) => {
    try {
      const body = updateNameSchema.parse(request.body);
      const { userId, sessionToken } = getAuthFromRequest(request);

      if (!userId || !sessionToken) {
        return reply.code(401).send({
          success: false,
          error: "Unauthorized",
        });
      }

      const profile = await updateDisplayName({
        userId,
        sessionToken,
        displayName: body.display_name,
      });

      return {
        success: true,
        profile,
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

      return reply.code(400).send({
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to update profile",
      });
    }
  });

  app.post("/v1/profile/complete-onboarding", async (request, reply) => {
    try {
      const { userId, sessionToken } = getAuthFromRequest(request);

      if (!userId || !sessionToken) {
        return reply.code(401).send({
          success: false,
          error: "Unauthorized",
        });
      }

      const profile = await completeOnboarding({
        userId,
        sessionToken,
      });

      return {
        success: true,
        profile,
      };
    } catch (error) {
      return reply.code(400).send({
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to complete onboarding",
      });
    }
  });
}