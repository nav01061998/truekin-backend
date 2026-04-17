import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getHomepageConfig } from "../services/homepage-service.js";

const bodySchema = z.object({
  is_logged_in: z.boolean().default(false),
  display_name: z.string().nullable().optional(),
});

export async function registerHomeRoutes(app: FastifyInstance) {
  app.post("/v1/homepage", async (request, reply) => {
    try {
      const body = bodySchema.parse(request.body);

      // Determine mode based on login state
      const mode = body.is_logged_in ? "authenticated" : "guest";

      // Fetch configuration from database
      const config = await getHomepageConfig(mode);

      // Customize greeting if display name provided and authenticated
      let greeting = config.greeting;
      if (body.is_logged_in && body.display_name) {
        greeting = `Welcome back, ${body.display_name}`;
      }

      return {
        content: {
          ...config,
          mode,
          greeting,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load homepage content";
      console.error("Homepage error:", error);
      return reply.code(400).send({
        error: message,
      });
    }
  });
}

