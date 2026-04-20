import type { FastifyInstance } from "fastify";
import { z, ZodError } from "zod";
import { getAppVersion, compareVersions, getUpdateType } from "../services/app-version-service.js";

const versionCheckSchema = z.object({
  appVersion: z.string(),
  appName: z.string(),
  platform: z.enum(["ios", "android"]),
  buildNumber: z.string(),
  osVersion: z.string(),
  deviceModel: z.string(),
});

export async function registerAppRoutes(app: FastifyInstance) {
  // POST /v1/app/version-check
  app.post("/v1/app/version-check", async (request, reply) => {
    try {
      const body = versionCheckSchema.parse(request.body);

      // Fetch version info from database for this platform
      const appVersionData = await getAppVersion(body.platform);

      if (!appVersionData) {
        return reply.code(503).send({
          success: false,
          error: "Version information unavailable",
        });
      }

      const currentVersion = appVersionData.latest_version;
      const latestVersion = appVersionData.latest_version;
      const minimumSupportedVersion = appVersionData.minimum_supported_version;

      // Determine update status
      const updateType = getUpdateType(body.appVersion, latestVersion, minimumSupportedVersion);
      const updateRequired = updateType === "required";
      const updateAvailable = updateType === "optional" || updateType === "required";

      return {
        success: true,
        updateAvailable,
        updateRequired,
        currentVersion,
        latestVersion,
        minimumSupportedVersion,
        updateType,
        releaseNotes: appVersionData.release_notes,
        updateUrl: appVersionData.update_url,
        changelog: appVersionData.changelog,
      };
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.code(400).send({
          success: false,
          error: "Invalid request body",
        });
      }

      console.error("Error in version check:", error);
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : "Failed to check version",
      });
    }
  });
}
