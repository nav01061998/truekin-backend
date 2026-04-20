import type { FastifyInstance } from "fastify";
import { z, ZodError } from "zod";
import {
  updateDisplayName,
  saveGender,
  saveDateOfBirth,
  saveAddress,
  saveBloodGroup,
  saveHeight,
  saveWeight,
  saveFoodAllergies,
  saveMedicineAllergies,
  saveHealthConditions,
  type UserProfile,
} from "../services/profile-service.js";

function readHeader(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return undefined;
}

function getAuthFromRequest(request: { headers: Record<string, unknown> }) {
  return {
    userId:
      readHeader(request.headers["x-user-id"]) ||
      readHeader(request.headers["X-User-Id"]),
    sessionToken:
      readHeader(request.headers["x-session-token"]) ||
      readHeader(request.headers["X-Session-Token"]),
  };
}

const onboardingNameSchema = z.object({
  display_name: z.string().min(1).max(50),
});

const onboardingGenderSchema = z.object({
  gender: z.enum(["male", "female", "other", "prefer not to say"]),
});

const onboardingDateOfBirthSchema = z.object({
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const onboardingDetailsSchema = z.object({
  email: z.string().email().optional(),
  address: z.string().min(10).max(200).optional(),
  blood_group: z.enum(["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"]).optional(),
  height: z.number().min(100).max(250).optional(),
  weight: z.number().min(20).max(250).optional(),
  health_conditions: z.array(z.string()).optional(),
  food_allergies: z.array(z.string()).optional(),
  medicine_allergies: z.array(z.string()).optional(),
});

export async function registerOnboardingRoutes(app: FastifyInstance) {
  // POST /onboarding/name
  app.post("/onboarding/name", async (request, reply) => {
    try {
      const body = onboardingNameSchema.parse(request.body);
      const { userId, sessionToken } = getAuthFromRequest(request);

      if (!userId || !sessionToken) {
        return reply.code(401).send({
          error: "Unauthorized",
        });
      }

      const profile = await updateDisplayName({
        userId,
        sessionToken,
        displayName: body.display_name,
      });

      return profile;
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.code(400).send({
          error: "Invalid request body",
        });
      }

      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Failed to update name",
      });
    }
  });

  // POST /onboarding/gender
  app.post("/onboarding/gender", async (request, reply) => {
    try {
      const body = onboardingGenderSchema.parse(request.body);
      const { userId, sessionToken } = getAuthFromRequest(request);

      if (!userId || !sessionToken) {
        return reply.code(401).send({
          error: "Unauthorized",
        });
      }

      const profile = await saveGender({
        userId,
        sessionToken,
        gender: body.gender,
      });

      return profile;
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.code(400).send({
          error: "Invalid request body",
        });
      }

      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Failed to save gender",
      });
    }
  });

  // POST /onboarding/date-of-birth
  app.post("/onboarding/date-of-birth", async (request, reply) => {
    try {
      const body = onboardingDateOfBirthSchema.parse(request.body);
      const { userId, sessionToken } = getAuthFromRequest(request);

      if (!userId || !sessionToken) {
        return reply.code(401).send({
          error: "Unauthorized",
        });
      }

      const profile = await saveDateOfBirth({
        userId,
        sessionToken,
        dateOfBirth: body.date_of_birth,
      });

      return profile;
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.code(400).send({
          error: "Invalid request body",
        });
      }

      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Failed to save date of birth",
      });
    }
  });

  // POST /onboarding/details
  app.post("/onboarding/details", async (request, reply) => {
    try {
      const body = onboardingDetailsSchema.parse(request.body);
      const { userId, sessionToken } = getAuthFromRequest(request);

      if (!userId || !sessionToken) {
        return reply.code(401).send({
          error: "Unauthorized",
        });
      }

      let profile: UserProfile | undefined;

      // Update address if provided
      if (body.address) {
        profile = await saveAddress({
          userId,
          sessionToken,
          address: body.address,
        });
      }

      // Update blood group if provided
      if (body.blood_group) {
        profile = await saveBloodGroup({
          userId,
          sessionToken,
          bloodGroup: body.blood_group,
        });
      }

      // Update height if provided
      if (body.height) {
        profile = await saveHeight({
          userId,
          sessionToken,
          height: body.height,
        });
      }

      // Update weight if provided
      if (body.weight) {
        profile = await saveWeight({
          userId,
          sessionToken,
          weight: body.weight,
        });
      }

      // Update health conditions if provided
      if (body.health_conditions && body.health_conditions.length > 0) {
        profile = await saveHealthConditions({
          userId,
          sessionToken,
          healthConditions: body.health_conditions,
        });
      }

      // Update food allergies if provided
      if (body.food_allergies && body.food_allergies.length > 0) {
        profile = await saveFoodAllergies({
          userId,
          sessionToken,
          foodAllergies: body.food_allergies,
        });
      }

      // Update medicine allergies if provided
      if (body.medicine_allergies && body.medicine_allergies.length > 0) {
        profile = await saveMedicineAllergies({
          userId,
          sessionToken,
          medicineAllergies: body.medicine_allergies,
        });
      }

      if (!profile) {
        throw new Error("Failed to update profile");
      }

      return profile;
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.code(400).send({
          error: "Invalid request body",
        });
      }

      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Failed to save details",
      });
    }
  });
}
