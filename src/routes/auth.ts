import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { sendOtp, verifyOtp } from "../services/otp-service.js";

const phoneSchema = z.object({
  phone: z.string().min(4),
});

const verifySchema = z.object({
  phone: z.string().min(4),
  otp: z.string().length(6),
});

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post("/v1/auth/otp/send", async (request, reply) => {
    try {
      const body = phoneSchema.parse(request.body);
      return await sendOtp(body.phone);
    } catch (error) {
      return reply.code(400).send({
        success: false,
        error: error instanceof Error ? error.message : "Failed to send OTP",
      });
    }
  });

  app.post("/v1/auth/otp/verify", async (request, reply) => {
    try {
      const body = verifySchema.parse(request.body);
      const result = await verifyOtp(body);
      return {
        success: true,
        user_id: result.userId,
        is_new_user: result.isNewUser,
        token_hash: result.tokenHash,
        bypass: result.bypass,
        user: result.user,
      };
    } catch (error) {
      return reply.code(400).send({
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to verify OTP",
      });
    }
  });
}

