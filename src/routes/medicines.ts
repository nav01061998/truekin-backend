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

      if (!userId || !sessionToken) {
        console.warn(`[${requestId}] Missing authentication headers`);
        return reply.code(401).send({
          success: false,
          error: "Missing authentication headers",
          code: "MISSING_AUTH",
          requestId,
        });
      }

      // STEP 2: Validate session
      console.log(`[${requestId}] Step 2: Validating session`);
      try {
        await assertValidSession({ userId, sessionToken });
      } catch (sessionError) {
        const errorMsg = sessionError instanceof Error ? sessionError.message : String(sessionError);
        console.error(`[${requestId}] Session validation failed:`, errorMsg);
        return reply.code(401).send({
          success: false,
          error: "Invalid or expired session token",
          code: "UNAUTHORIZED",
          requestId,
        });
      }

      // STEP 3: Validate request body
      console.log(`[${requestId}] Step 3: Validating request body`);
      let body;
      try {
        body = addMedicineSchema.parse(request.body);
      } catch (validationError) {
        const firstError = validationError instanceof ZodError ? validationError.issues[0] : null;
        const errorMsg = firstError?.message || "Validation error";
        console.error(`[${requestId}] Body validation failed:`, errorMsg);
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

      console.log(`[${requestId}] Medicine added successfully:`, medicine.id);
      logger.info("MEDICINES_ADD_SUCCESS", { requestId, userId, medicineId: medicine.id });

      return {
        data: medicinesList,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[${requestId}] Fatal error:`, errorMessage);
      logger.error("MEDICINES_ADD_ERROR", { requestId, error: errorMessage });

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
      // STEP 1: Extract authentication from headers FIRST
      console.log(`[${requestId}] Step 1: Extracting auth from headers`);
      const userId = readHeader(request.headers["x-user-id"]) || readHeader(request.headers["X-User-Id"]);
      const sessionToken = readHeader(request.headers["x-session-token"]) || readHeader(request.headers["X-Session-Token"]);

      if (!userId || !sessionToken) {
        console.warn(`[${requestId}] Missing authentication headers`);
        logger.warn("MEDICINES_MISSING_AUTH", { requestId });
        return reply.code(401).send({
          success: false,
          error: "Missing authentication headers",
          code: "MISSING_AUTH",
          requestId,
        });
      }

      // STEP 2: Validate session
      console.log(`[${requestId}] Step 2: Validating session`);
      try {
        await assertValidSession({ userId, sessionToken });
      } catch (sessionError) {
        const errorMsg = sessionError instanceof Error ? sessionError.message : String(sessionError);
        console.error(`[${requestId}] Session validation failed:`, errorMsg);
        logger.error("MEDICINES_SESSION_INVALID", { requestId, error: errorMsg });
        return reply.code(401).send({
          success: false,
          error: "Invalid or expired session token",
          code: "UNAUTHORIZED",
          requestId,
          message: errorMsg,
        });
      }

      // STEP 3: Parse and validate query parameters
      console.log(`[${requestId}] Step 3: Parsing query parameters:`, request.query);
      let queryParams;
      try {
        queryParams = medicinesQuerySchema.parse(request.query);
        console.log(`[${requestId}] Query params validated:`, queryParams);
      } catch (validationError) {
        const firstError = validationError instanceof ZodError ? validationError.issues[0] : null;
        const errorMsg = firstError?.message || "Validation error";
        console.error(`[${requestId}] Query validation failed:`, errorMsg);
        logger.error("MEDICINES_QUERY_VALIDATION_ERROR", { requestId, error: errorMsg });
        return reply.code(400).send({
          success: false,
          error: errorMsg,
          code: "INVALID_PAGINATION",
          requestId,
        });
      }

      // STEP 4: Fetch medicines list
      console.log(`[${requestId}] Step 4: Fetching medicines list`);
      const medicinesList = await getMedicinesList({
        userId,
        consumingPage: queryParams.consumingPage,
        consumingLimit: queryParams.consumingLimit,
        pastPage: queryParams.pastPage,
        pastLimit: queryParams.pastLimit,
      });

      console.log(`[${requestId}] Medicines list fetched successfully`);
      logger.info("MEDICINES_FETCH_SUCCESS", {
        requestId,
        userId,
        consumingCount: medicinesList.consumingCurrently.medicines.length,
        pastSections: medicinesList.pastMedicines.sections.length,
      });

      return {
        data: medicinesList,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[${requestId}] Fatal error:`, errorMessage);
      logger.error("MEDICINES_FETCH_ERROR", { requestId, error: errorMessage });

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
