import type { FastifyInstance } from "fastify";

export async function registerHealthRoutes(app: FastifyInstance) {
  // Root endpoint
  app.get("/", async () => ({
    ok: true,
    service: "truekin-backend",
    message: "Welcome to TrueKin API",
  }));

  // Health check endpoints
  app.get("/health", async () => ({
    ok: true,
    service: "truekin-backend",
  }));

  app.get("/v1/health", async () => ({
    ok: true,
    service: "truekin-backend",
  }));
}

