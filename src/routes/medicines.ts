import type { FastifyInstance } from "fastify";
import { z, ZodError } from "zod";
import { addMedicine, getMedicinesList } from "../services/medicines-service.js";
import { assertValidSession } from "../services/session-service.js";
import logger from "../lib/logger.js";

function readHeader(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return undefined;
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

// Query parameters schema - NO userId here (comes from headers)
const medicinesQuerySchema = z.object({
  consumingPage: z.coerce.number().int().min(1).optional().default(1),
  consumingLimit: z.coerce.number().int().min(1).max(100).optional().default(10),
  pastPage: z.coerce.number().int().min(1).optional().default(1),
  pastLimit: z.coerce.number().int().min(1).max(100).optional().default(10),
});

export async function registerMedicinesRoutes(app: FastifyInstance) {
  // POST /api/medicines/add - Add a new medicine
  app.post("/api/medicines/add", async (request, reply) => {
    const requestId = `med-add-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      // STEP 1: Extract authentication from headers FIRST
      console.log(`[${requestId}] Step 1: Extracting auth from headers`);
      const userId = readHeader(request.headers["x-user-id"]) || readHeader(request.headers["X-User-Id"]);
      const sessionToken = readHeader(request.headers["x-session-token"]) || readHeader(request.headers["X-Session-Token"]);

      console.log(`[${requestId}] Step 1: Auth extracted - userId: ${userId ? "present" : "MISSING"}, sessionToken: ${sessionToken ? "present" : "MISSING"}`);

      if (!userId || !sessionToken) {
        console.warn(`[${requestId}] Step 1: Missing authentication headers`);
        logger.warn("MEDICINES_ADD_MISSING_AUTH", { requestId });
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
        console.log(`[${requestId}] Step 2: Session validated successfully`);
        logger.info("MEDICINES_ADD_SESSION_VALID", { requestId, userId });
      } catch (sessionError) {
        const errorMsg = sessionError instanceof Error ? sessionError.message : String(sessionError);
        console.error(`[${requestId}] Step 2: Session validation failed:`, errorMsg);
        logger.error("MEDICINES_ADD_SESSION_INVALID", { requestId, userId, error: errorMsg });
        return reply.code(401).send({
          success: false,
          error: "Invalid or expired session token",
          code: "UNAUTHORIZED",
          requestId,
          message: errorMsg,
        });
      }

      // STEP 3: Validate request body
      console.log(`[${requestId}] Step 3: Validating request body`);
      let body;
      try {
        body = addMedicineSchema.parse(request.body);
        console.log(`[${requestId}] Step 3: Body validation successful:`, {
          name: body.name,
          dosage: body.dosage,
          frequency: body.frequency,
          indication: body.indication,
          status: body.status,
        });
        logger.info("MEDICINES_ADD_BODY_VALID", { requestId, medicineName: body.name, status: body.status });
      } catch (validationError) {
        const firstError = validationError instanceof ZodError ? validationError.issues[0] : null;
        const errorMsg = firstError?.message || "Validation error";
        console.error(`[${requestId}] Step 3: Body validation failed:`, errorMsg);
        logger.error("MEDICINES_ADD_BODY_VALIDATION_ERROR", { requestId, error: errorMsg });
        return reply.code(400).send({
          success: false,
          error: errorMsg,
          code: "VALIDATION_ERROR",
          requestId,
        });
      }

      // STEP 4: Add medicine
      console.log(`[${requestId}] Step 4: Adding medicine`);
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

      console.log(`[${requestId}] Step 4: Medicine added successfully - id: ${medicine.id}`);
      console.log(`[${requestId}] Step 4: Updated medicines list - consuming: ${medicinesList.consumingCurrently.medicines.length}, past sections: ${medicinesList.pastMedicines.sections.length}`);
      logger.info("MEDICINES_ADD_SUCCESS", {
        requestId,
        userId,
        medicineId: medicine.id,
        consumingCount: medicinesList.consumingCurrently.medicines.length,
        pastSections: medicinesList.pastMedicines.sections.length,
      });

      console.log(`[${requestId}] POST /api/medicines/add completed successfully`);
      return {
        data: medicinesList,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : "No stack trace";
      console.error(`[${requestId}] FATAL ERROR:`, {
        name: error instanceof Error ? error.constructor.name : "Unknown",
        message: errorMessage,
        stack: errorStack,
      });
      logger.error("MEDICINES_ADD_FATAL_ERROR", {
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

  // GET /v1/medicines - Get medicines list with pagination
  app.get("/v1/medicines", async (request, reply) => {
    const requestId = `med-list-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      // STEP 1: Extract authentication from headers FIRST (BEFORE any validation)
      console.log(`[${requestId}] Step 1: Extracting auth from headers`);
      const userId = readHeader(request.headers["x-user-id"]) || readHeader(request.headers["X-User-Id"]);
      const sessionToken = readHeader(request.headers["x-session-token"]) || readHeader(request.headers["X-Session-Token"]);

      console.log(`[${requestId}] Step 1: Auth extracted - userId: ${userId ? "present" : "MISSING"}, sessionToken: ${sessionToken ? "present" : "MISSING"}`);

      if (!userId || !sessionToken) {
        console.warn(`[${requestId}] Step 1: Missing authentication headers`);
        logger.warn("MEDICINES_LIST_MISSING_AUTH", { requestId, hasUserId: !!userId, hasSessionToken: !!sessionToken });
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
        console.log(`[${requestId}] Step 2: Session validated successfully`);
        logger.info("MEDICINES_LIST_SESSION_VALID", { requestId, userId });
      } catch (sessionError) {
        const errorMsg = sessionError instanceof Error ? sessionError.message : String(sessionError);
        console.error(`[${requestId}] Step 2: Session validation failed:`, errorMsg);
        logger.error("MEDICINES_LIST_SESSION_INVALID", { requestId, userId, error: errorMsg });
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
        queryParams = medicinesQuerySchema.parse(request.query);
        console.log(`[${requestId}] Step 3: Query params validated successfully:`, queryParams);
        logger.info("MEDICINES_LIST_QUERY_PARSED", {
          requestId,
          consumingPage: queryParams.consumingPage,
          consumingLimit: queryParams.consumingLimit,
          pastPage: queryParams.pastPage,
          pastLimit: queryParams.pastLimit,
        });
      } catch (validationError) {
        const firstError = validationError instanceof ZodError ? validationError.issues[0] : null;
        const errorMsg = firstError?.message || "Validation error";
        console.error(`[${requestId}] Step 3: Query validation failed:`, errorMsg);
        logger.error("MEDICINES_LIST_QUERY_VALIDATION_ERROR", { requestId, error: errorMsg });
        return reply.code(400).send({
          success: false,
          error: errorMsg,
          code: "INVALID_PAGINATION",
          requestId,
        });
      }

      // STEP 4: Fetch medicines list
      console.log(`[${requestId}] Step 4: Fetching medicines list for user: ${userId}`);
      const medicinesList = await getMedicinesList({
        userId,
        consumingPage: queryParams.consumingPage,
        consumingLimit: queryParams.consumingLimit,
        pastPage: queryParams.pastPage,
        pastLimit: queryParams.pastLimit,
      });

      // STEP 5: Return response
      console.log(`[${requestId}] Step 5: Successfully built response:`, {
        consuming: {
          count: medicinesList.consumingCurrently.medicines.length,
          total: medicinesList.consumingCurrently.pagination.total,
          page: medicinesList.consumingCurrently.pagination.page,
          hasMore: medicinesList.consumingCurrently.pagination.hasMore,
        },
        past: {
          sections: medicinesList.pastMedicines.sections.length,
          page: medicinesList.pastMedicines.sections[0]?.pagination?.page || 1,
        },
      });
      logger.info("MEDICINES_LIST_API_SUCCESS", {
        requestId,
        userId,
        consumingCount: medicinesList.consumingCurrently.medicines.length,
        consumingTotal: medicinesList.consumingCurrently.pagination.total,
        pastSections: medicinesList.pastMedicines.sections.length,
      });

      console.log(`[${requestId}] GET /v1/medicines completed successfully`);
      return {
        data: medicinesList,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : "No stack trace";

      console.error(`[${requestId}] FATAL ERROR:`, {
        name: error instanceof Error ? error.constructor.name : "Unknown",
        message: errorMessage,
        stack: errorStack,
      });

      logger.error("MEDICINES_LIST_API_FATAL_ERROR", {
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

  // GET /api/medicines/list - Legacy endpoint (redirects to /v1/medicines)
  app.get("/api/medicines/list", async (request, reply) => {
    // Build query string from request.query
    const queryEntries: string[] = [];
    if (request.query && typeof request.query === "object") {
      for (const [key, value] of Object.entries(request.query)) {
        if (value !== null && value !== undefined) {
          queryEntries.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
        }
      }
    }
    const queryString = queryEntries.length > 0 ? `?${queryEntries.join("&")}` : "";
    const redirectUrl = `/v1/medicines${queryString}`;
    return reply.redirect(redirectUrl);
  });
}
