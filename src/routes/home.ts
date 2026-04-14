import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { buildHomeContent } from "../services/home-service.js";

const bodySchema = z.object({
  is_logged_in: z.boolean().default(false),
  display_name: z.string().nullable().optional(),
});

export async function registerHomeRoutes(app: FastifyInstance) {
  app.post("/v1/homepage", async (request) => {
    const body = bodySchema.parse(request.body);
    return buildHomeContent({
      isLoggedIn: body.is_logged_in,
      displayName: body.display_name,
    });
  });
}

