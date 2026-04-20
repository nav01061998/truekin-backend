import type { FastifyInstance } from "fastify";
import { z, ZodError } from "zod";

const versionCheckSchema = z.object({
  appVersion: z.string(),
  appName: z.string(),
  platform: z.enum(["ios", "android", "web"]),
  buildNumber: z.string(),
  osVersion: z.string(),
  deviceModel: z.string(),
});

export async function registerAppRoutes(app: FastifyInstance) {
  // POST /v1/app/version-check
  app.post("/v1/app/version-check", async (request, reply) => {
    try {
      const body = versionCheckSchema.parse(request.body);

      // Define version constraints
      const currentVersion = "1.0.0";
      const latestVersion = "1.0.0";
      const minimumSupportedVersion = "0.9.0";

      // Parse versions for comparison
      const parseVersion = (v: string) => {
        const parts = v.split(".").map(Number);
        return {
          major: parts[0] || 0,
          minor: parts[1] || 0,
          patch: parts[2] || 0,
        };
      };

      const clientVersion = parseVersion(body.appVersion);
      const latestVersionParts = parseVersion(latestVersion);
      const minimumVersionParts = parseVersion(minimumSupportedVersion);

      // Check if update is required
      let updateRequired = false;
      let updateAvailable = false;
      let updateType = "none";

      // Check if version is below minimum supported
      if (
        clientVersion.major < minimumVersionParts.major ||
        (clientVersion.major === minimumVersionParts.major && clientVersion.minor < minimumVersionParts.minor) ||
        (clientVersion.major === minimumVersionParts.major && clientVersion.minor === minimumVersionParts.minor && clientVersion.patch < minimumVersionParts.patch)
      ) {
        updateRequired = true;
        updateType = "required";
      }
      // Check if newer version is available
      else if (
        clientVersion.major < latestVersionParts.major ||
        (clientVersion.major === latestVersionParts.major && clientVersion.minor < latestVersionParts.minor) ||
        (clientVersion.major === latestVersionParts.major && clientVersion.minor === latestVersionParts.minor && clientVersion.patch < latestVersionParts.patch)
      ) {
        updateAvailable = true;
        updateType = "optional";
      }

      return {
        success: true,
        updateAvailable,
        updateRequired,
        currentVersion,
        latestVersion,
        minimumSupportedVersion,
        updateType,
      };
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.code(400).send({
          success: false,
          error: "Invalid request body",
        });
      }

      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : "Failed to check version",
      });
    }
  });
}
