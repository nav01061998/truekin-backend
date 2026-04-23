import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
// @ts-ignore - uuid has issues with module resolution
import { v4 as uuidv4 } from "uuid";
import logger, { logRequest, logResponse, logError } from "../lib/logger.js";

/**
 * Request context with request ID
 */
declare global {
  namespace Express {
    interface Request {
      id: string;
      startTime: number;
    }
  }
}

/**
 * Register logging middleware
 */
export async function setupLoggingMiddleware(app: FastifyInstance) {
  // Add request ID and timestamp to all requests
  app.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
    // Generate unique request ID
    (request as any).id = request.headers["x-request-id"] || uuidv4();
    (request as any).startTime = Date.now();

    // Set request ID in response headers for client tracking
    reply.header("x-request-id", (request as any).id);

    // Log incoming request
    logRequest(
      (request as any).id,
      request.method,
      request.url,
      (request as any).userId,
      request.query as Record<string, any>,
      request.headers as Record<string, any>
    );
  });

  // Log response
  app.addHook("onResponse", async (request: FastifyRequest, reply: FastifyReply) => {
    const requestId = (request as any).id;
    const startTime = (request as any).startTime;
    const duration = Date.now() - startTime;

    // Estimate response size
    const responseSize = reply.getHeader("content-length")
      ? parseInt(reply.getHeader("content-length") as string)
      : 0;

    logResponse(requestId, request.method, request.url, reply.statusCode, duration, undefined, responseSize);
  });

  // Log errors
  app.setErrorHandler(async (error, request, reply) => {
    const requestId = (request as any).id;
    const startTime = (request as any).startTime;
    const duration = startTime ? Date.now() - startTime : 0;

    // Log the error
    logError(requestId, request.method, request.url, reply.statusCode, error, undefined, duration);

    // Determine error status and message
    let statusCode = reply.statusCode || 500;
    let errorMessage = "Internal server error";
    let errorCode = "INTERNAL_ERROR";

    if (error instanceof Error) {
      errorMessage = error.message;

      // Custom error handling based on error type
      if (error.message.includes("Unauthorized") || error.message.includes("Session")) {
        statusCode = 401;
        errorCode = "UNAUTHORIZED";
      } else if (error.message.includes("Forbidden") || error.message.includes("not authenticated")) {
        statusCode = 403;
        errorCode = "FORBIDDEN";
      } else if (error.message.includes("not found") || error.message.includes("No documents")) {
        statusCode = 404;
        errorCode = "NOT_FOUND";
      } else if (error.message.includes("already exists")) {
        statusCode = 409;
        errorCode = "CONFLICT";
      } else if (error.message.includes("required")) {
        statusCode = 400;
        errorCode = "VALIDATION_ERROR";
      }
    }

    // Send error response to client
    reply.code(statusCode).send({
      success: false,
      error: errorCode,
      message: errorMessage,
      requestId, // Include request ID for debugging
      timestamp: new Date().toISOString(),
    });

    // Don't re-throw, we've handled it
    return;
  });
}

/**
 * Extract user ID from request headers
 */
export function extractUserId(request: FastifyRequest): string | undefined {
  return (
    (request.headers["x-user-id"] as string) ||
    (request.headers["X-User-Id"] as string) ||
    (Array.isArray(request.headers["x-user-id"])
      ? (request.headers["x-user-id"] as string[])[0]
      : undefined)
  );
}

/**
 * Get request ID
 */
export function getRequestId(request: FastifyRequest): string {
  return (request as any).id || uuidv4();
}
