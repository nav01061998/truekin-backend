import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { analyzePrescription } from "../services/prescription-service.js";

const bodySchema = z.object({
  image_url: z.string().url(),
});

export async function registerPrescriptionRoutes(app: FastifyInstance) {
  app.post("/v1/prescriptions/analyze", async (request, reply) => {
    try {
      const body = bodySchema.parse(request.body);
      return await analyzePrescription(body.image_url);
    } catch (error) {
      return reply.code(400).send({
        medicines: [],
        error:
          error instanceof Error
            ? error.message
            : "Failed to analyze prescription",
      });
    }
  });
}

