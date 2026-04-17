import Fastify from "fastify";
import cors from "@fastify/cors";
import { setupGateway } from "./lib/gateway.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerAppRoutes } from "./routes/app.js";
import { registerAdminRoutes } from "./routes/admin.js";
import { registerHomeRoutes } from "./routes/home.js";
import { registerSupportRoutes } from "./routes/support.js";
import { registerPrescriptionRoutes } from "./routes/prescriptions.js";
import { registerProfileRoutes } from "./routes/profile.js";
import { registerOnboardingRoutes } from "./routes/onboarding.js";

export async function buildApp() {
  const app = Fastify({
    logger: true,
  });

  // Register CORS
  await app.register(cors, {
    origin: true,
  });

  // Setup API Gateway (request validation, rate limiting, logging, etc.)
  await setupGateway(app);

  // Register routes
  await registerHealthRoutes(app);
  await registerAuthRoutes(app);
  await registerAppRoutes(app);
  await registerAdminRoutes(app);
  await registerOnboardingRoutes(app);
  await registerHomeRoutes(app);
  await registerSupportRoutes(app);
  await registerPrescriptionRoutes(app);
  await registerProfileRoutes(app);

  return app;
}
