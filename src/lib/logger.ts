import winston from "winston";
// @ts-ignore - winston-elasticsearch doesn't have proper TypeScript types
const ElasticsearchTransport = require("winston-elasticsearch").ElasticsearchTransport;

// Environment configuration
const elkEnabled = process.env.ELK_ENABLED === "true";
const elkNode = process.env.ELK_NODE || "http://localhost:9200";
const environment = process.env.NODE_ENV || "development";

// Create logger instance
const logger = winston.createLogger({
  defaultMeta: { service: "truekin-backend", environment },
  level: process.env.LOG_LEVEL || "info",
});

// Console transport for all environments
logger.add(
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
      winston.format.errors({ stack: true }),
      winston.format.splat(),
      winston.format.json(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        return JSON.stringify({
          timestamp,
          level,
          message,
          ...meta,
        });
      })
    ),
  })
);

// File transport for errors
logger.add(
  new winston.transports.File({
    filename: "logs/error.log",
    level: "error",
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
  })
);

// File transport for all logs
logger.add(
  new winston.transports.File({
    filename: "logs/combined.log",
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
  })
);

// ELK Transport - sends logs to Elasticsearch
if (elkEnabled) {
  logger.add(
    new ElasticsearchTransport({
      level: "info",
      clientOpts: { node: elkNode },
      index: "truekin-logs",
      transformer: (logData: any) => {
        return {
          "@timestamp": new Date(),
          message: logData.message,
          severity: logData.level,
          fields: logData.meta,
          service: "truekin-backend",
          environment,
        };
      },
      flushInterval: 2000, // Flush logs every 2 seconds
    })
  );
}

/**
 * Log API request
 */
export function logRequest(
  requestId: string,
  method: string,
  path: string,
  userId?: string,
  queryParams?: Record<string, any>,
  headers?: Record<string, any>
) {
  logger.info("API_REQUEST", {
    requestId,
    method,
    path,
    userId,
    queryParams: sanitizeData(queryParams),
    headers: sanitizeHeaders(headers),
  });
}

/**
 * Log API response
 */
export function logResponse(
  requestId: string,
  method: string,
  path: string,
  statusCode: number,
  duration: number,
  userId?: string,
  responseSize?: number
) {
  logger.info("API_RESPONSE", {
    requestId,
    method,
    path,
    statusCode,
    duration,
    userId,
    responseSize,
  });
}

/**
 * Log API error
 */
export function logError(
  requestId: string,
  method: string,
  path: string,
  statusCode: number,
  error: Error | unknown,
  userId?: string,
  duration?: number
) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  logger.error("API_ERROR", {
    requestId,
    method,
    path,
    statusCode,
    userId,
    duration,
    errorMessage,
    errorStack,
    errorType: error instanceof Error ? error.constructor.name : "Unknown",
  });
}

/**
 * Log database query
 */
export function logDatabase(
  requestId: string,
  operation: string,
  table: string,
  duration: number,
  success: boolean,
  error?: string
) {
  const level = success ? "info" : "error";
  logger[level as "info" | "error"]("DATABASE_OPERATION", {
    requestId,
    operation,
    table,
    duration,
    success,
    error,
  });
}

/**
 * Log authentication event
 */
export function logAuth(
  requestId: string,
  action: "LOGIN" | "LOGOUT" | "SIGNUP" | "TOKEN_VALIDATION",
  userId: string,
  success: boolean,
  reason?: string
) {
  const level = success ? "info" : "warn";
  logger[level as "info" | "warn"]("AUTH_EVENT", {
    requestId,
    action,
    userId,
    success,
    reason,
  });
}

/**
 * Log business event
 */
export function logBusiness(
  requestId: string,
  eventType: string,
  userId: string,
  data?: Record<string, any>
) {
  logger.info("BUSINESS_EVENT", {
    requestId,
    eventType,
    userId,
    data: sanitizeData(data),
  });
}

/**
 * Sanitize sensitive data from logs
 */
function sanitizeData(data?: Record<string, any>): Record<string, any> | undefined {
  if (!data) return undefined;

  const sanitized = { ...data };
  const sensitiveKeys = ["password", "token", "secret", "key", "apiKey", "sessionToken"];

  sensitiveKeys.forEach((key) => {
    if (sanitized[key]) {
      sanitized[key] = "***REDACTED***";
    }
  });

  return sanitized;
}

/**
 * Sanitize headers (remove auth headers, cookies, etc.)
 */
function sanitizeHeaders(headers?: Record<string, any>): Record<string, any> | undefined {
  if (!headers) return undefined;

  const sanitized: Record<string, any> = {};
  const allowedHeaders = ["content-type", "accept", "user-agent"];

  Object.entries(headers).forEach(([key, value]) => {
    if (allowedHeaders.includes(key.toLowerCase())) {
      sanitized[key] = value;
    } else if (
      key.toLowerCase().includes("auth") ||
      key.toLowerCase().includes("cookie") ||
      key.toLowerCase().includes("token")
    ) {
      sanitized[key] = "***REDACTED***";
    } else {
      sanitized[key] = value;
    }
  });

  return sanitized;
}

export default logger;
