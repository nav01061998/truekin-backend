import type { FastifyInstance } from "fastify";
import { z, ZodError } from "zod";
import { updateVersionConfig } from "../services/app-version-service.js";

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
    adminToken:
      readHeader(request.headers["x-admin-token"]) ||
      readHeader(request.headers["X-Admin-Token"]),
  };
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

// Simple admin token validation (in production, use proper auth)
function validateAdminToken(token: string | undefined): boolean {
  const expectedToken = process.env.ADMIN_TOKEN || "admin-secret-key";
  return token === expectedToken;
}

export async function registerAdminRoutes(app: FastifyInstance) {
  app.post("/v1/admin/app-versions/update", async (request, reply) => {
    try {
      const { adminToken } = getAuthFromRequest(request);

      if (!validateAdminToken(adminToken)) {
        return reply.code(401).send({
          error: "Unauthorized. Invalid admin token.",
        });
      }

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

      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Failed to update version",
      });
    }
  });

  // Health check endpoint for admin operations
  app.get("/v1/admin/health", async (request, reply) => {
    const { adminToken } = getAuthFromRequest(request);

    if (!validateAdminToken(adminToken)) {
      return reply.code(401).send({
        error: "Unauthorized",
      });
    }

    return {
      success: true,
      status: "healthy",
      timestamp: new Date().toISOString(),
    };
  });
}
