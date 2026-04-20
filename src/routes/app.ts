import type { FastifyInstance } from "fastify";

export async function registerAppRoutes(app: FastifyInstance) {
  // GET /v1/app/version-check
  app.get("/v1/app/version-check", async (request, reply) => {
    try {
      // Return current version and whether update is available
      const currentVersion = "1.0.0";
      const updateAvailable = false; // Can be set based on your versioning logic

      return {
        current_version: currentVersion,
        update_available: updateAvailable,
      };
    } catch (error) {
      return reply.code(500).send({
        error: error instanceof Error ? error.message : "Failed to check version",
      });
    }
  });
}
