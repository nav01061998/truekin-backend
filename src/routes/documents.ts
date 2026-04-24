import type { FastifyInstance } from "fastify";
import { z, ZodError } from "zod";
import { getAllDocuments } from "../services/documents-service.js";
import logger from "../lib/logger.js";

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
  prescriptionsPage: z.coerce.number().int().min(1).optional().default(1),
  prescriptionsLimit: z.coerce.number().int().min(1).max(100).optional().default(10),
  prescriptionsStatus: z.string().optional(),
  prescriptionsFromDate: z.string().optional(),
  prescriptionsToDate: z.string().optional(),
  reportsPage: z.coerce.number().int().min(1).optional().default(1),
  reportsLimit: z.coerce.number().int().min(1).max(100).optional().default(10),
  reportsStatus: z.string().optional(),
  reportsFromDate: z.string().optional(),
  reportsToDate: z.string().optional(),
});

export async function registerDocumentsRoutes(app: FastifyInstance) {
  // GET /v1/documents - Get all documents (prescriptions and reports)
  app.get("/v1/documents", async (request, reply) => {
    const requestId = `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      // LOG: Request received
      logger.info("DOCUMENTS_API_REQUEST", {
        requestId,
        method: "GET",
        path: "/v1/documents",
        query: request.query,
        headers: {
          userId: request.headers["x-user-id"],
          sessionToken: request.headers["x-session-token"] ? "***REDACTED***" : "MISSING",
        },
      });

      // Parse query parameters
      console.log(`[${requestId}] Parsing query parameters:`, request.query);
      const queryParams = documentsQuerySchema.parse(request.query);
      console.log(`[${requestId}] Query params parsed successfully:`, queryParams);
      logger.info("DOCUMENTS_QUERY_PARSED", { requestId, queryParams });

      // Extract auth from headers
      console.log(`[${requestId}] Extracting auth from headers`);
      const { userId, sessionToken } = getAuthFromRequest(request);
      console.log(`[${requestId}] Auth extracted - userId: ${userId ? "present" : "MISSING"}, sessionToken: ${sessionToken ? "present" : "MISSING"}`);

      if (!userId || !sessionToken) {
        console.warn(`[${requestId}] Missing auth - userId or sessionToken missing`);
        logger.warn("DOCUMENTS_MISSING_AUTH", {
          requestId,
          hasUserId: !!userId,
          hasSessionToken: !!sessionToken,
        });
        return reply.code(401).send({
          success: false,
          error: "Invalid or expired session token",
          code: "UNAUTHORIZED",
          requestId,
        });
      }

      // Verify requested userId matches authenticated user (security check)
      console.log(`[${requestId}] Verifying userId match - queryUserId: ${queryParams.userId}, authUserId: ${userId}`);
      if (queryParams.userId !== userId) {
        console.warn(`[${requestId}] UserId mismatch!`);
        logger.warn("DOCUMENTS_USERID_MISMATCH", {
          requestId,
          queryUserId: queryParams.userId,
          authUserId: userId,
        });
        return reply.code(403).send({
          success: false,
          error: "Unauthorized to access this user's documents",
          code: "FORBIDDEN",
          requestId,
        });
      }

      // LOG: About to call getAllDocuments
      console.log(`[${requestId}] Calling getAllDocuments with params:`, {
        userId: queryParams.userId,
        prescriptionsPage: queryParams.prescriptionsPage,
        prescriptionsLimit: queryParams.prescriptionsLimit,
        prescriptionsStatus: queryParams.prescriptionsStatus,
        reportsPage: queryParams.reportsPage,
        reportsLimit: queryParams.reportsLimit,
        reportsStatus: queryParams.reportsStatus,
      });

      const documentsData = await getAllDocuments({
        userId: queryParams.userId,
        sessionToken,
        prescriptionsPage: queryParams.prescriptionsPage,
        prescriptionsLimit: queryParams.prescriptionsLimit,
        prescriptionsStatus: queryParams.prescriptionsStatus,
        prescriptionsFromDate: queryParams.prescriptionsFromDate,
        prescriptionsToDate: queryParams.prescriptionsToDate,
        reportsPage: queryParams.reportsPage,
        reportsLimit: queryParams.reportsLimit,
        reportsStatus: queryParams.reportsStatus,
        reportsFromDate: queryParams.reportsFromDate,
        reportsToDate: queryParams.reportsToDate,
      });

      console.log(`[${requestId}] Successfully fetched documents:`, {
        prescriptions: {
          count: documentsData.prescriptions.documents.length,
          total: documentsData.prescriptions.pagination.total,
          page: documentsData.prescriptions.pagination.page,
          hasMore: documentsData.prescriptions.pagination.hasMore,
        },
        reports: {
          count: documentsData.reports.documents.length,
          total: documentsData.reports.pagination.total,
          page: documentsData.reports.pagination.page,
          hasMore: documentsData.reports.pagination.hasMore,
        },
      });
      logger.info("DOCUMENTS_API_SUCCESS", {
        requestId,
        prescriptionsCount: documentsData.prescriptions.documents.length,
        prescriptionsTotal: documentsData.prescriptions.pagination.total,
        reportsCount: documentsData.reports.documents.length,
        reportsTotal: documentsData.reports.pagination.total,
      });

      return documentsData;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : "No stack trace";

      console.error(`[${requestId}] ERROR:`, {
        name: error instanceof Error ? error.constructor.name : "Unknown",
        message: errorMessage,
        stack: errorStack,
        error: error,
      });

      logger.error("DOCUMENTS_API_ERROR", {
        requestId,
        errorName: error instanceof Error ? error.constructor.name : "Unknown",
        errorMessage: errorMessage,
        errorStack: errorStack,
      });

      if (error instanceof ZodError) {
        console.error(`[${requestId}] ZodError - validation failed:`, error.issues);
        const firstError = error.issues[0];
        logger.error("DOCUMENTS_VALIDATION_ERROR", {
          requestId,
          issues: error.issues,
        });
        return reply.code(400).send({
          success: false,
          error: firstError.message || "Validation error",
          code: "MISSING_REQUIRED_FIELD",
          requestId,
          details: error.issues,
        });
      }

      if (errorMessage.includes("Unauthorized") || errorMessage.includes("Session expired")) {
        console.error(`[${requestId}] Session error detected`);
        return reply.code(401).send({
          success: false,
          error: "Invalid or expired session token",
          code: "UNAUTHORIZED",
          requestId,
          message: errorMessage,
        });
      }

      if (errorMessage.includes("userId is required")) {
        console.error(`[${requestId}] userId required error`);
        return reply.code(400).send({
          success: false,
          error: "userId is required",
          code: "MISSING_REQUIRED_FIELD",
          requestId,
        });
      }

      console.error(`[${requestId}] Unhandled error in documents route:`, error);
      return reply.code(500).send({
        success: false,
        error: "Internal server error",
        code: "INTERNAL_ERROR",
        requestId,
        message: errorMessage,
      });
    }
  });
}
