import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { sendOtp, verifyOtp } from "../services/otp-service.js";
import { calculateCompletionPercentage } from "../services/profile-service.js";

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

      // Calculate completion percentage
      const completionPercentage = result.user ? calculateCompletionPercentage(result.user) : 0;

      return {
        error: null,
        isNewUser: result.isNewUser,
        onboardingCompleted: result.user?.onboarding_completed ?? false,
        userProfile: result.user ? {
          id: result.user.id,
          phone: result.user.phone,
          display_name: result.user.display_name ?? null,
          gender: result.user.gender ?? null,
          date_of_birth: result.user.date_of_birth ?? null,
          health_conditions: result.user.health_conditions ?? null,
          avatar_url: result.user.avatar_url ?? null,
          onboarding_completed: result.user.onboarding_completed ?? false,
          user_journey_selection_shown: result.user.user_journey_selection_shown ?? false,
          completion_percentage: completionPercentage,
        } : undefined,
      };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Failed to verify OTP",
        isNewUser: false,
      });
    }
  });
}

