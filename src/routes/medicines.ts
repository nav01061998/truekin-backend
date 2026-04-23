import type { FastifyInstance } from "fastify";
import { z, ZodError } from "zod";
import { addMedicine, getMedicinesList } from "../services/medicines-service.js";

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

const addMedicineSchema = z.object({
  name: z.string().min(1, "Medicine name is required").max(100),
  dosage: z.string().min(1, "Dosage is required").max(50),
  frequency: z.string().min(1, "Frequency is required"),
  indication: z.string().min(1, "Indication is required"),
  components: z.string().optional(),
  prescribedBy: z.string().optional(),
  startedOn: z.string().optional(),
  status: z.enum(["active", "inactive", "discontinued"]),
});

export async function registerMedicinesRoutes(app: FastifyInstance) {
  // Add medicine endpoint
  app.post("/api/medicines/add", async (request, reply) => {
    try {
      const body = addMedicineSchema.parse(request.body);
      const { userId, sessionToken } = getAuthFromRequest(request);

      if (!userId || !sessionToken) {
        return reply.code(401).send({
          success: false,
          message: "Invalid or expired session token",
        });
      }

      const { medicine, medicinesList } = await addMedicine({
        userId,
        sessionToken,
        name: body.name,
        dosage: body.dosage,
        frequency: body.frequency,
        indication: body.indication,
        components: body.components,
        prescribedBy: body.prescribedBy,
        startedOn: body.startedOn,
        status: body.status,
      });

      return {
        data: medicinesList,
      };
    } catch (error) {
      if (error instanceof ZodError) {
        const firstError = error.issues[0];
        return reply.code(400).send({
          success: false,
          message: firstError.message || "Validation error",
        });
      }

      const message = error instanceof Error ? error.message : "Failed to add medicine";

      // Handle specific error cases
      if (message.includes("Unauthorized") || message.includes("Session expired")) {
        return reply.code(401).send({
          success: false,
          message: "Invalid or expired session token",
        });
      }

      if (message.includes("not authenticated")) {
        return reply.code(403).send({
          success: false,
          message: "User not authenticated",
        });
      }

      if (message.includes("already exists")) {
        return reply.code(409).send({
          success: false,
          message: message,
        });
      }

      if (message.includes("is required") || message.includes("Invalid")) {
        return reply.code(400).send({
          success: false,
          message: message,
        });
      }

      return reply.code(500).send({
        success: false,
        message: "Internal server error. Please try again later.",
      });
    }
  });

  // Get medicines list endpoint
  app.get("/api/medicines/list", async (request, reply) => {
    try {
      const { userId, sessionToken } = getAuthFromRequest(request);

      if (!userId || !sessionToken) {
        return reply.code(401).send({
          success: false,
          message: "Invalid or expired session token",
        });
      }

      // Verify session
      const { getCurrentUserProfile } = await import("../services/profile-service.js");
      await getCurrentUserProfile({ userId, sessionToken });

      const medicinesList = await getMedicinesList(userId);

      return {
        data: medicinesList,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch medicines";

      if (message.includes("Unauthorized") || message.includes("Session expired")) {
        return reply.code(401).send({
          success: false,
          message: "Invalid or expired session token",
        });
      }

      if (message.includes("not authenticated")) {
        return reply.code(403).send({
          success: false,
          message: "User not authenticated",
        });
      }

      return reply.code(500).send({
        success: false,
        message: "Internal server error. Please try again later.",
      });
    }
  });
}
