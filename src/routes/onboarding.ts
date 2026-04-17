import type { FastifyInstance } from "fastify";
import { z, ZodError } from "zod";
import {
  updateDisplayName,
  saveDateOfBirth,
  saveHealthConditions,
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

const saveNameSchema = z.object({
  display_name: z.string().min(1, "Name is required").max(50, "Name is too long"),
});

const saveDateOfBirthSchema = z.object({
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format. Use YYYY-MM-DD"),
});

const saveHealthConditionsSchema = z.object({
  health_conditions: z
    .array(z.string().min(1).max(100))
    .min(1, "At least one health condition is required"),
});

export async function registerOnboardingRoutes(app: FastifyInstance) {
  app.post("/onboarding/name", async (request, reply) => {
    try {
      const body = saveNameSchema.parse(request.body);
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

      return {
        success: true,
        user: profile,
      };
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.code(400).send({
          error: error.issues[0]?.message || "Invalid request body",
        });
      }

      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Failed to save name",
      });
    }
  });

  app.post("/onboarding/date-of-birth", async (request, reply) => {
    try {
      const body = saveDateOfBirthSchema.parse(request.body);
      const { userId, sessionToken } = getAuthFromRequest(request);

      if (!userId || !sessionToken) {
        return reply.code(401).send({
          error: "Unauthorized",
        });
      }

      const profile = await saveDateOfBirth({
        userId,
        sessionToken,
        dateOfBirth: body.date_of_birth,
      });

      return {
        success: true,
        user: profile,
      };
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.code(400).send({
          error: error.issues[0]?.message || "Invalid request body",
        });
      }

      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Failed to save date of birth",
      });
    }
  });

  app.post("/onboarding/details", async (request, reply) => {
    try {
      const body = saveHealthConditionsSchema.parse(request.body);
      const { userId, sessionToken } = getAuthFromRequest(request);

      if (!userId || !sessionToken) {
        return reply.code(401).send({
          error: "Unauthorized",
        });
      }

      const profile = await saveHealthConditions({
        userId,
        sessionToken,
        healthConditions: body.health_conditions,
      });

      return {
        success: true,
        user: profile,
      };
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.code(400).send({
          error: error.issues[0]?.message || "Invalid request body",
        });
      }

      return reply.code(400).send({
        error:
          error instanceof Error ? error.message : "Failed to save health conditions",
      });
    }
  });
}
