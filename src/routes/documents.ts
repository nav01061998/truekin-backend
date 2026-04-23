import type { FastifyInstance } from "fastify";
import { z, ZodError } from "zod";
import { getAllDocuments } from "../services/documents-service.js";

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

const documentsQuerySchema = z.object({
  userId: z.string().min(1, "userId is required"),
  type: z.enum(["prescriptions", "reports", "all"]).optional().default("all"),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  offset: z.coerce.number().int().nonnegative().optional().default(0),
  status: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
});

export async function registerDocumentsRoutes(app: FastifyInstance) {
  // GET /v1/documents - Get all documents (prescriptions and reports)
  app.get("/v1/documents", async (request, reply) => {
    try {
      // Parse query parameters
      const queryParams = documentsQuerySchema.parse(request.query);
      const { userId, sessionToken } = getAuthFromRequest(request);

      if (!userId || !sessionToken) {
        return reply.code(401).send({
          success: false,
          error: "Invalid or expired session token",
          code: "UNAUTHORIZED",
        });
      }

      // Verify requested userId matches authenticated user (security check)
      if (queryParams.userId !== userId) {
        return reply.code(403).send({
          success: false,
          error: "Unauthorized to access this user's documents",
          code: "FORBIDDEN",
        });
      }

      const documentsData = await getAllDocuments({
        userId: queryParams.userId,
        sessionToken,
        type: queryParams.type,
        limit: queryParams.limit,
        offset: queryParams.offset,
        status: queryParams.status,
        fromDate: queryParams.fromDate,
        toDate: queryParams.toDate,
      });

      return {
        success: true,
        data: documentsData,
      };
    } catch (error) {
      if (error instanceof ZodError) {
        const firstError = error.issues[0];
        return reply.code(400).send({
          success: false,
          error: firstError.message || "Validation error",
          code: "MISSING_REQUIRED_FIELD",
        });
      }

      const message = error instanceof Error ? error.message : "Failed to fetch documents";

      if (message.includes("Unauthorized") || message.includes("Session expired")) {
        return reply.code(401).send({
          success: false,
          error: "Invalid or expired session token",
          code: "UNAUTHORIZED",
        });
      }

      if (message.includes("userId is required")) {
        return reply.code(400).send({
          success: false,
          error: "userId is required",
          code: "MISSING_REQUIRED_FIELD",
        });
      }

      console.error("Error fetching documents:", error);
      return reply.code(500).send({
        success: false,
        error: "Internal server error",
        code: "INTERNAL_ERROR",
      });
    }
  });
}
