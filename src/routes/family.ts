import type { FastifyInstance } from "fastify";
import { z, ZodError } from "zod";
import {
  getFamilyMembers,
  addFamilyMember,
  removeFamilyMember,
} from "../services/family-service.js";

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

const addFamilyMemberSchema = z.object({
  linked_user_id: z.string().min(1, "linked_user_id is required"),
  role: z.enum(["spouse", "parent", "child", "sibling", "other"]),
  nickname: z.string().optional(),
});

export async function registerFamilyRoutes(app: FastifyInstance) {
  // GET /v1/family - Get all family members
  app.get("/v1/family", async (request, reply) => {
    try {
      const { userId, sessionToken } = getAuthFromRequest(request);

      if (!userId || !sessionToken) {
        return reply.code(401).send({
          error: "Unauthorized",
          message: "Your session has expired. Please login again.",
        });
      }

      const familyMembers = await getFamilyMembers({
        userId,
        sessionToken,
      });

      return familyMembers;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch family members";

      if (message.includes("Unauthorized") || message.includes("Session expired")) {
        return reply.code(401).send({
          error: "Unauthorized",
          message: "Your session has expired. Please login again.",
        });
      }

      if (message.includes("User not found")) {
        return reply.code(404).send({
          error: "Not Found",
          message: "User not found",
        });
      }

      console.error("Error fetching family members:", error);
      return reply.code(500).send({
        error: "Internal Server Error",
        message: "Failed to fetch family members",
      });
    }
  });

  // POST /v1/family - Add a new family member
  app.post("/v1/family", async (request, reply) => {
    try {
      const body = addFamilyMemberSchema.parse(request.body);
      const { userId, sessionToken } = getAuthFromRequest(request);

      if (!userId || !sessionToken) {
        return reply.code(401).send({
          error: "Unauthorized",
          message: "Your session has expired. Please login again.",
        });
      }

      const familyMember = await addFamilyMember({
        userId,
        sessionToken,
        linked_user_id: body.linked_user_id,
        role: body.role,
        nickname: body.nickname,
      });

      return reply.code(201).send(familyMember);
    } catch (error) {
      if (error instanceof ZodError) {
        const firstError = error.issues[0];
        return reply.code(400).send({
          error: "Validation Error",
          message: firstError.message || "Validation error",
        });
      }

      const message = error instanceof Error ? error.message : "Failed to add family member";

      if (message.includes("Unauthorized") || message.includes("Session expired")) {
        return reply.code(401).send({
          error: "Unauthorized",
          message: "Your session has expired. Please login again.",
        });
      }

      if (message.includes("not found")) {
        return reply.code(404).send({
          error: "Not Found",
          message: message,
        });
      }

      if (message.includes("already exists")) {
        return reply.code(409).send({
          error: "Conflict",
          message: message,
        });
      }

      if (message.includes("is required") || message.includes("Invalid")) {
        return reply.code(400).send({
          error: "Validation Error",
          message: message,
        });
      }

      console.error("Error adding family member:", error);
      return reply.code(500).send({
        error: "Internal Server Error",
        message: "Failed to add family member",
      });
    }
  });

  // DELETE /v1/family/:familyId - Remove a family member
  app.delete<{ Params: { familyId: string } }>("/v1/family/:familyId", async (request, reply) => {
    try {
      const { familyId } = request.params;
      const { userId, sessionToken } = getAuthFromRequest(request);

      if (!userId || !sessionToken) {
        return reply.code(401).send({
          error: "Unauthorized",
          message: "Your session has expired. Please login again.",
        });
      }

      if (!familyId) {
        return reply.code(400).send({
          error: "Validation Error",
          message: "familyId is required",
        });
      }

      await removeFamilyMember({
        userId,
        sessionToken,
        familyId,
      });

      return {
        success: true,
        message: "Family member removed successfully",
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to remove family member";

      if (message.includes("Unauthorized") || message.includes("Session expired")) {
        return reply.code(401).send({
          error: "Unauthorized",
          message: "Your session has expired. Please login again.",
        });
      }

      if (message.includes("not found")) {
        return reply.code(404).send({
          error: "Not Found",
          message: "Family relationship not found",
        });
      }

      console.error("Error removing family member:", error);
      return reply.code(500).send({
        error: "Internal Server Error",
        message: "Failed to remove family member",
      });
    }
  });
}
