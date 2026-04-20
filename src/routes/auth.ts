import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { sendOtp, verifyOtp } from "../services/otp-service.js";
import { type UserProfile } from "../services/profile-service.js";

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

      // Convert user to 17-field UserProfile format
      let userProfile: UserProfile | undefined;
      if (result.user) {
        userProfile = {
          id: result.user.id,
          phone: result.user.phone,
          display_name: result.user.display_name || null,
          gender: result.user.gender || null,
          date_of_birth: result.user.date_of_birth || null,
          health_conditions: result.user.health_conditions || null,
          avatar_url: result.user.avatar_url || null,
          onboarding_completed: result.user.onboarding_completed === true,
          user_journey_selection_shown: result.user.user_journey_selection_shown === true,
          email: result.user.email || null,
          email_verified: result.user.email_verified === true,
          address: result.user.address || null,
          blood_group: result.user.blood_group || null,
          height: result.user.height || null,
          weight: result.user.weight || null,
          food_allergies: result.user.food_allergies || null,
          medicine_allergies: result.user.medicine_allergies || null,
        };
      }

      return {
        success: true,
        user_id: result.userId,
        is_new_user: result.is_new_user,
        token_hash: result.token_hash,
        user: userProfile,
      };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Failed to verify OTP",
        is_new_user: false,
      });
    }
  });
}

