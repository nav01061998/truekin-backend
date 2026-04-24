import type { FastifyInstance } from "fastify";
import { z, ZodError } from "zod";
import { getAllDocuments } from "../services/documents-service.js";
import { assertValidSession } from "../services/session-service.js";
import logger from "../lib/logger.js";

function readHeader(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return undefined;
}

// Query parameters schema - NO userId here (comes from headers)
const documentsQuerySchema = z.object({
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
      // STEP 1: Extract authentication from headers FIRST (BEFORE any validation)
      console.log(`[${requestId}] Step 1: Extracting auth from headers`);
      const userId = readHeader(request.headers["x-user-id"]) || readHeader(request.headers["X-User-Id"]);
      const sessionToken = readHeader(request.headers["x-session-token"]) || readHeader(request.headers["X-Session-Token"]);

      console.log(`[${requestId}] Auth extracted - userId: ${userId ? "present" : "MISSING"}, sessionToken: ${sessionToken ? "present" : "MISSING"}`);

      // Validate auth headers exist
      if (!userId || !sessionToken) {
        console.warn(`[${requestId}] Missing authentication headers`);
        logger.warn("DOCUMENTS_MISSING_AUTH", { requestId, hasUserId: !!userId, hasSessionToken: !!sessionToken });
        return reply.code(401).send({
          success: false,
          error: "Missing authentication headers",
          code: "MISSING_AUTH",
          requestId,
        });
      }

      // STEP 2: Validate session
      console.log(`[${requestId}] Step 2: Validating session for user: ${userId}`);
      let authUser;
      try {
        authUser = await assertValidSession({ userId, sessionToken });
        console.log(`[${requestId}] Session validated successfully`);
        logger.info("DOCUMENTS_SESSION_VALID", { requestId, userId });
      } catch (sessionError) {
        const errorMsg = sessionError instanceof Error ? sessionError.message : String(sessionError);
        console.error(`[${requestId}] Session validation failed:`, errorMsg);
        logger.error("DOCUMENTS_SESSION_INVALID", { requestId, userId, error: errorMsg });
        return reply.code(401).send({
          success: false,
          error: "Invalid or expired session token",
          code: "UNAUTHORIZED",
          requestId,
          message: errorMsg,
        });
      }

      // STEP 3: Parse and validate query parameters (separate from auth)
      console.log(`[${requestId}] Step 3: Parsing query parameters:`, request.query);
      let queryParams;
      try {
        queryParams = documentsQuerySchema.parse(request.query);
        console.log(`[${requestId}] Query params validated successfully:`, queryParams);
        logger.info("DOCUMENTS_QUERY_PARSED", { requestId, queryParams });
      } catch (validationError) {
        const firstError = validationError instanceof ZodError ? validationError.issues[0] : null;
        const errorMsg = firstError?.message || "Validation error";
        console.error(`[${requestId}] Query validation failed:`, errorMsg);
        logger.error("DOCUMENTS_QUERY_VALIDATION_ERROR", { requestId, error: errorMsg });
        return reply.code(400).send({
          success: false,
          error: errorMsg,
          code: "INVALID_PAGINATION",
          requestId,
        });
      }

      // STEP 4: Fetch documents
      console.log(`[${requestId}] Step 4: Fetching documents for user: ${userId}`);
      const documentsData = await getAllDocuments({
        userId,
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

      // STEP 5: Return response
      console.log(`[${requestId}] Step 5: Successfully built response:`, {
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
        userId,
        prescriptionsCount: documentsData.prescriptions.documents.length,
        prescriptionsTotal: documentsData.prescriptions.pagination.total,
        reportsCount: documentsData.reports.documents.length,
        reportsTotal: documentsData.reports.pagination.total,
      });

      return documentsData;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : "No stack trace";

      console.error(`[${requestId}] FATAL ERROR:`, {
        name: error instanceof Error ? error.constructor.name : "Unknown",
        message: errorMessage,
        stack: errorStack,
      });

      logger.error("DOCUMENTS_API_FATAL_ERROR", {
        requestId,
        errorName: error instanceof Error ? error.constructor.name : "Unknown",
        errorMessage: errorMessage,
        errorStack: errorStack,
      });

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
