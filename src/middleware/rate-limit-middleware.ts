import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { checkRateLimit, getRemainingRequests, getResetTime } from "../lib/rate-limiter.js";

/**
 * Rate limiting configuration for different endpoints
 */
const rateLimitConfig: Record<
  string,
  {
    limit: number;
    windowMs: number;
    message: string;
  }
> = {
  // OTP endpoints - strict rate limiting
  "/v1/profile/email/send-otp": {
    limit: 5,
    windowMs: 60 * 60 * 1000, // 1 hour
    message: "Too many email OTP requests. Please try again after 1 hour",
  },
  "/v1/profile/phone/send-otp": {
    limit: 5,
    windowMs: 60 * 60 * 1000, // 1 hour
    message: "Too many phone OTP requests. Please try again after 1 hour",
  },
  "/v1/profile/email/verify-otp": {
    limit: 10,
    windowMs: 60 * 60 * 1000, // 1 hour
    message: "Too many email verification attempts. Please try again after 1 hour",
  },
  "/v1/profile/phone/verify-otp": {
    limit: 10,
    windowMs: 60 * 60 * 1000, // 1 hour
    message: "Too many phone verification attempts. Please try again after 1 hour",
  },

  // Profile update endpoints - moderate rate limiting
  "/v1/profile/update": {
    limit: 50,
    windowMs: 60 * 60 * 1000, // 1 hour
    message: "Too many profile updates. Please try again after 1 hour",
  },

  // Authentication endpoints
  "/v1/auth/otp/send": {
    limit: 5,
    windowMs: 60 * 60 * 1000, // 1 hour
    message: "Too many login attempts. Please try again after 1 hour",
  },

  // Default for other endpoints
  default: {
    limit: 100,
    windowMs: 60 * 1000, // 1 minute
    message: "Too many requests. Please try again later",
  },
};

/**
 * Create rate limiting middleware
 */
export function createRateLimitMiddleware(app: FastifyInstance) {
  app.addHook("preHandler", async (request: FastifyRequest, reply: FastifyReply) => {
    // Skip rate limiting for unauthenticated endpoints (health, root, etc.)
    if (request.url === "/" || request.url === "/health" || request.url.startsWith("/docs")) {
      return;
    }

    const config = rateLimitConfig[request.url] || rateLimitConfig.default;

    // Get user ID for rate limit key (use IP for unauthenticated requests)
    const userId =
      request.headers["x-user-id"] ||
      request.headers["X-User-Id"] ||
      request.ip ||
      "anonymous";

    const key = `${userId}:${request.url}`;

    // Check rate limit
    if (!checkRateLimit(key, config.limit, config.windowMs)) {
      const remaining = getRemainingRequests(key, config.limit, config.windowMs);
      const resetTime = getResetTime(key, config.windowMs);

      reply.code(429).header("Retry-After", resetTime.toString()).send({
        success: false,
        error: config.message,
        remaining,
        resetTime,
      });

      return;
    }

    // Add rate limit headers
    const remaining = getRemainingRequests(key, config.limit, config.windowMs);
    reply.header("X-RateLimit-Limit", config.limit.toString());
    reply.header("X-RateLimit-Remaining", remaining.toString());
    reply.header("X-RateLimit-Reset", getResetTime(key, config.windowMs).toString());
  });
}
