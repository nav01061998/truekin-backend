import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { randomUUID } from "crypto";
import { supabaseAdmin } from "./supabase.js";

// Request context that flows through the gateway
export type RequestContext = {
  requestId: string;
  userId?: string;
  sessionToken?: string;
  timestamp: Date;
  userAgent?: string;
  ip?: string;
  authenticated: boolean;
};

// Rate limit config
type RateLimitConfig = {
  windowMs: number; // milliseconds
  maxRequests: number;
};

// Track rate limits in memory (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100,
};

// Public endpoints that don't require rate limiting
const PUBLIC_ENDPOINTS = ["/v1/app/version-check", "/v1/health"];

// Endpoints that require session auth (including admin endpoints)
const PROTECTED_ENDPOINTS = ["/onboarding", "/v1/profile", "/v1/admin"];

/**
 * Extract authentication headers from request
 */
function extractAuth(request: FastifyRequest): {
  userId?: string;
  sessionToken?: string;
} {
  const readHeader = (key: string): string | undefined => {
    const value = request.headers[key.toLowerCase()];
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value[0];
    return undefined;
  };

  return {
    userId: readHeader("x-user-id"),
    sessionToken: readHeader("x-session-token"),
  };
}

/**
 * Validate session token with Supabase
 */
async function validateSession(userId: string, sessionToken: string): Promise<boolean> {
  try {
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(
      userId
    );

    if (authError || !authUser?.user) {
      return false;
    }

    const { data: sessionRow, error: sessionError } = await supabaseAdmin
      .from("auth_sessions")
      .select("user_id, session_token_hash, expires_at, revoked_at")
      .eq("user_id", userId)
      .eq("session_token_hash", sessionToken)
      .maybeSingle();

    if (sessionError || !sessionRow) {
      return false;
    }

    if (sessionRow.revoked_at) {
      return false;
    }

    if (new Date(sessionRow.expires_at).getTime() <= Date.now()) {
      return false;
    }

    return true;
  } catch (error) {
    console.error("Session validation error:", error);
    return false;
  }
}

/**
 * Check rate limit for an IP/User
 */
function checkRateLimit(key: string, config: RateLimitConfig): boolean {
  const now = Date.now();
  const record = rateLimitStore.get(key);

  if (!record || now >= record.resetTime) {
    // Window expired or first request
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + config.windowMs,
    });
    return true;
  }

  if (record.count >= config.maxRequests) {
    return false;
  }

  record.count++;
  return true;
}

/**
 * Check if endpoint is public (no auth required)
 */
function isPublicEndpoint(path: string): boolean {
  return PUBLIC_ENDPOINTS.some((endpoint) => path.startsWith(endpoint));
}

/**
 * Check if endpoint requires session auth
 */
function isProtectedEndpoint(path: string): boolean {
  return PROTECTED_ENDPOINTS.some((endpoint) => path.startsWith(endpoint));
}

/**
 * Main gateway middleware
 */
export async function setupGateway(app: FastifyInstance) {
  // Generate request ID and extract auth
  app.addHook("preHandler", async (request, reply) => {
    const requestId = randomUUID();
    const { userId, sessionToken } = extractAuth(request);

    // Attach context to request
    (request as any).context = {
      requestId,
      userId,
      sessionToken,
      timestamp: new Date(),
      userAgent: request.headers["user-agent"],
      ip: request.ip,
      authenticated: !!userId && !!sessionToken,
    } as RequestContext;

    // Log request
    console.log({
      level: "info",
      requestId,
      method: request.method,
      path: request.url,
      ip: request.ip,
      userId: userId || "anonymous",
      timestamp: new Date().toISOString(),
    });

    // Check rate limiting (per IP, stricter for public endpoints)
    const isPublic = isPublicEndpoint(request.url);
    const rateLimitKey = userId || request.ip;
    const rateLimitConfig = isPublic
      ? { ...DEFAULT_RATE_LIMIT, maxRequests: 1000 } // Generous for public endpoints
      : DEFAULT_RATE_LIMIT;

    if (!checkRateLimit(rateLimitKey, rateLimitConfig)) {
      return reply.code(429).send({
        error: "Too many requests. Please try again later.",
      });
    }

    // Handle protected endpoints (require session auth)
    if (isProtectedEndpoint(request.url)) {
      if (!userId || !sessionToken) {
        return reply.code(401).send({
          error: "Authentication required",
        });
      }

      // Validate session
      const isValid = await validateSession(userId, sessionToken);
      if (!isValid) {
        return reply.code(401).send({
          error: "Invalid or expired session",
        });
      }
    }

    // Public endpoints can proceed
  });

  // Standardized error handling hook
  app.addHook("onError", async (request, reply, error) => {
    const context = (request as any).context as RequestContext;

    console.error({
      level: "error",
      requestId: context.requestId,
      method: request.method,
      path: request.url,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });

    if (!reply.sent) {
      reply.code(500).send({
        error: "Internal server error",
        requestId: context.requestId,
      });
    }
  });

  // Response logging hook
  app.addHook("onResponse", async (request, reply) => {
    const context = (request as any).context as RequestContext;

    console.log({
      level: "info",
      requestId: context.requestId,
      method: request.method,
      path: request.url,
      statusCode: reply.statusCode,
      duration: Date.now() - context.timestamp.getTime(),
      timestamp: new Date().toISOString(),
    });
  });
}

/**
 * Helper to get request context from request
 */
export function getContext(request: FastifyRequest): RequestContext {
  return (request as any).context;
}
