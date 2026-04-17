import type { FastifyInstance, FastifyRequest } from "fastify";
import { z, ZodError } from "zod";
import { updateVersionConfig } from "../services/app-version-service.js";
import {
  requireAdminRole,
  grantAdminRole,
  revokeAdminRole,
  listAdminUsers,
} from "../services/admin-service.js";
import type { SessionContext } from "../services/session-service.js";

function readHeader(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return undefined;
}

function getSessionFromRequest(request: FastifyRequest): SessionContext {
  const userId = readHeader(request.headers["x-user-id"]);
  const sessionToken = readHeader(request.headers["x-session-token"]);

  if (!userId || !sessionToken) {
    throw new Error("Missing authentication headers");
  }

  return { userId, sessionToken };
}

const updateVersionSchema = z.object({
  platform: z.enum(["ios", "android"]),
  latestVersion: z.string().regex(/^\d+\.\d+\.\d+$/, "Version must be in X.Y.Z format"),
  minimumSupportedVersion: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/, "Version must be in X.Y.Z format"),
  updateUrl: z.string().url("Invalid update URL"),
  releaseNotes: z.string().min(1, "Release notes required"),
  releaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  changeLog: z.array(
    z.object({
      version: z.string(),
      date: z.string(),
      features: z.array(z.string()),
      bugFixes: z.array(z.string()),
    })
  ),
});

const grantAdminSchema = z.object({
  targetUserId: z.string().uuid("Invalid user ID format"),
});

const revokeAdminSchema = z.object({
  targetUserId: z.string().uuid("Invalid user ID format"),
});

export async function registerAdminRoutes(app: FastifyInstance) {
  // Update app version configuration
  app.post("/v1/admin/app-versions/update", async (request, reply) => {
    try {
      const session = getSessionFromRequest(request);
      await requireAdminRole(session);

      const body = updateVersionSchema.parse(request.body);

      const result = await updateVersionConfig({
        platform: body.platform,
        latestVersion: body.latestVersion,
        minimumSupportedVersion: body.minimumSupportedVersion,
        updateUrl: body.updateUrl,
        releaseNotes: body.releaseNotes,
        releaseDate: body.releaseDate,
        changeLog: body.changeLog,
      });

      return {
        success: true,
        message: `Version updated for ${body.platform}`,
        data: {
          platform: result.platform,
          latestVersion: result.latestVersion,
          minimumSupportedVersion: result.minimumSupportedVersion,
          updateUrl: result.updateUrl,
          releaseNotes: result.releaseNotes,
          releaseDate: result.releaseDate,
          changeLog: result.changeLog,
        },
      };
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.code(400).send({
          error: "Validation failed",
          details: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        });
      }

      const message = error instanceof Error ? error.message : "Failed to update version";
      if (message === "Admin access required. User does not have admin role.") {
        return reply.code(403).send({ error: message });
      }
      if (message === "Unauthorized" || message === "Invalid or expired session") {
        return reply.code(401).send({ error: message });
      }

      return reply.code(400).send({ error: message });
    }
  });

  // Grant admin role to a user
  app.post("/v1/admin/users/grant-admin", async (request, reply) => {
    try {
      const session = getSessionFromRequest(request);
      const body = grantAdminSchema.parse(request.body);

      await grantAdminRole(session, body.targetUserId);

      return {
        success: true,
        message: `Admin role granted to user ${body.targetUserId}`,
      };
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.code(400).send({
          error: "Validation failed",
          details: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        });
      }

      const message = error instanceof Error ? error.message : "Failed to grant admin role";
      if (message === "Admin access required. User does not have admin role.") {
        return reply.code(403).send({ error: message });
      }
      if (message === "Unauthorized" || message === "Invalid or expired session") {
        return reply.code(401).send({ error: message });
      }

      return reply.code(400).send({ error: message });
    }
  });

  // Revoke admin role from a user
  app.post("/v1/admin/users/revoke-admin", async (request, reply) => {
    try {
      const session = getSessionFromRequest(request);
      const body = revokeAdminSchema.parse(request.body);

      await revokeAdminRole(session, body.targetUserId);

      return {
        success: true,
        message: `Admin role revoked from user ${body.targetUserId}`,
      };
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.code(400).send({
          error: "Validation failed",
          details: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        });
      }

      const message = error instanceof Error ? error.message : "Failed to revoke admin role";
      if (message === "Admin access required. User does not have admin role.") {
        return reply.code(403).send({ error: message });
      }
      if (message === "Unauthorized" || message === "Invalid or expired session") {
        return reply.code(401).send({ error: message });
      }

      return reply.code(400).send({ error: message });
    }
  });

  // List all admin users
  app.get("/v1/admin/users/admins", async (request, reply) => {
    try {
      const session = getSessionFromRequest(request);
      await requireAdminRole(session);

      const admins = await listAdminUsers();

      return {
        success: true,
        data: admins,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to list admin users";
      if (message === "Admin access required. User does not have admin role.") {
        return reply.code(403).send({ error: message });
      }
      if (message === "Unauthorized" || message === "Invalid or expired session") {
        return reply.code(401).send({ error: message });
      }

      return reply.code(400).send({ error: message });
    }
  });

  // Health check (no auth required)
  app.get("/v1/admin/health", async (request, reply) => {
    return {
      success: true,
      status: "healthy",
      timestamp: new Date().toISOString(),
    };
  });
}
