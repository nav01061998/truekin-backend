import type { FastifyReply } from "fastify";
import logger from "./logger.js";

/**
 * Standardized API error response
 */
export interface ApiErrorResponse {
  success: false;
  error: string;
  message: string;
  code?: string;
  requestId?: string;
  timestamp?: string;
}

/**
 * Custom API Error class
 */
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public errorCode: string,
    public errorMessage: string
  ) {
    super(errorMessage);
    this.name = "ApiError";
  }
}

/**
 * Send standardized error response
 */
export function sendError(
  reply: FastifyReply,
  statusCode: number,
  errorCode: string,
  errorMessage: string,
  requestId?: string
): void {
  const response: ApiErrorResponse = {
    success: false,
    error: errorCode,
    message: errorMessage,
    code: errorCode,
    requestId,
    timestamp: new Date().toISOString(),
  };

  reply.code(statusCode).send(response);
}

/**
 * Handle and log database errors
 */
export function handleDatabaseError(
  error: any,
  requestId: string,
  reply: FastifyReply,
  context: string = "database operation"
): void {
  logger.error(`Database error in ${context}`, {
    requestId,
    error: error.message,
    code: error.code,
    details: error,
  });

  let statusCode = 500;
  let errorCode = "DATABASE_ERROR";
  let errorMessage = `Failed to perform ${context}`;

  if (error.code === "PGRST116") {
    // No rows returned - this is expected in some cases
    return;
  }

  if (error.message?.includes("duplicate")) {
    statusCode = 409;
    errorCode = "DUPLICATE_ENTRY";
    errorMessage = "This record already exists";
  } else if (error.message?.includes("foreign key")) {
    statusCode = 400;
    errorCode = "INVALID_REFERENCE";
    errorMessage = "Invalid reference to related data";
  } else if (error.message?.includes("unique")) {
    statusCode = 409;
    errorCode = "DUPLICATE_ENTRY";
    errorMessage = "This value already exists";
  }

  sendError(reply, statusCode, errorCode, errorMessage, requestId);
}

/**
 * Handle session/auth errors
 */
export function handleAuthError(
  error: any,
  requestId: string,
  reply: FastifyReply
): void {
  logger.warn("Authentication error", {
    requestId,
    error: error.message,
  });

  const errorMessage = error.message || "Authentication failed";

  if (errorMessage.includes("Session expired") || errorMessage.includes("Unauthorized")) {
    sendError(reply, 401, "UNAUTHORIZED", "Invalid or expired session token", requestId);
  } else if (errorMessage.includes("not authenticated")) {
    sendError(reply, 403, "FORBIDDEN", "User not authenticated", requestId);
  } else {
    sendError(reply, 401, "AUTH_ERROR", errorMessage, requestId);
  }
}

/**
 * Handle validation errors
 */
export function handleValidationError(
  errorMessage: string,
  requestId: string,
  reply: FastifyReply
): void {
  logger.warn("Validation error", {
    requestId,
    error: errorMessage,
  });

  sendError(reply, 400, "VALIDATION_ERROR", errorMessage, requestId);
}

/**
 * Handle not found errors
 */
export function handleNotFoundError(
  resource: string,
  requestId: string,
  reply: FastifyReply
): void {
  const errorMessage = `${resource} not found`;

  logger.warn("Not found", {
    requestId,
    resource,
  });

  sendError(reply, 404, "NOT_FOUND", errorMessage, requestId);
}

/**
 * Handle generic errors
 */
export function handleGenericError(
  error: any,
  requestId: string,
  reply: FastifyReply,
  context: string = "request"
): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  logger.error(`Error during ${context}`, {
    requestId,
    error: errorMessage,
    stack: errorStack,
  });

  // Check for specific error patterns
  if (errorMessage.includes("Unauthorized") || errorMessage.includes("Session expired")) {
    sendError(reply, 401, "UNAUTHORIZED", "Invalid or expired session token", requestId);
  } else if (errorMessage.includes("not authenticated")) {
    sendError(reply, 403, "FORBIDDEN", "User not authenticated", requestId);
  } else if (errorMessage.includes("not found")) {
    sendError(reply, 404, "NOT_FOUND", errorMessage, requestId);
  } else if (errorMessage.includes("already exists")) {
    sendError(reply, 409, "CONFLICT", errorMessage, requestId);
  } else if (errorMessage.includes("required")) {
    sendError(reply, 400, "VALIDATION_ERROR", errorMessage, requestId);
  } else {
    sendError(reply, 500, "INTERNAL_ERROR", "Internal server error. Please try again later.", requestId);
  }
}

/**
 * Error codes
 */
export const ErrorCodes = {
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  DATABASE_ERROR: "DATABASE_ERROR",
  AUTH_ERROR: "AUTH_ERROR",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  MISSING_REQUIRED_FIELD: "MISSING_REQUIRED_FIELD",
  INVALID_REQUEST: "INVALID_REQUEST",
  RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND",
} as const;
