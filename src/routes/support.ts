import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createSupportTicket } from "../services/support-service.js";

const bodySchema = z.object({
  user_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1),
  email: z.string().email().nullable().optional().or(z.literal("")),
  phone: z.string().nullable().optional().or(z.literal("")),
  message: z.string().min(1),
  source: z.string().optional(),
});

export async function registerSupportRoutes(app: FastifyInstance) {
  app.post("/v1/support/tickets", async (request, reply) => {
    try {
      const body = bodySchema.parse(request.body);
      const data = await createSupportTicket({
        userId: body.user_id ?? null,
        name: body.name,
        email: body.email || null,
        phone: body.phone || null,
        message: body.message,
        source: body.source,
      });

      return {
        success: true,
        ticket_id: data.id,
      };
    } catch (error) {
      return reply.code(400).send({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to submit support ticket",
      });
    }
  });
}

