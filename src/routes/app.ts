import type { FastifyInstance } from "fastify";
import { z, ZodError } from "zod";
import { checkAppVersion } from "../services/app-version-service.js";

const versionCheckSchema = z.object({
  appVersion: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/, "App version must be in format X.Y.Z (e.g., 1.0.0)"),
  appName: z.string().min(1),
  platform: z.enum(["ios", "android"]),
  buildNumber: z.string().optional(),
  osVersion: z.string().optional(),
  deviceModel: z.string().optional(),
});

export async function registerAppRoutes(app: FastifyInstance) {
  // Version check endpoint (no authentication required)
  app.post("/v1/app/version-check", async (request, reply) => {
    try {
      const body = versionCheckSchema.parse(request.body);

      const versionCheckResponse = await checkAppVersion({
        appVersion: body.appVersion,
        appName: body.appName,
        platform: body.platform,
        buildNumber: body.buildNumber,
        osVersion: body.osVersion,
        deviceModel: body.deviceModel,
      });

      return versionCheckResponse;
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.code(400).send({
          success: false,
          error: error.issues[0]?.message || "Invalid request body",
        });
      }

      return reply.code(400).send({
        success: false,
        error: error instanceof Error ? error.message : "Failed to check app version",
      });
    }
  });
}
