import Fastify from "fastify";
import cors from "@fastify/cors";
import { setupGateway } from "./lib/gateway.js";
import { initializeFirebaseAdmin } from "./lib/firebase.js";
import { createRateLimitMiddleware } from "./middleware/rate-limit-middleware.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerAppRoutes } from "./routes/app.js";
import { registerAdminRoutes } from "./routes/admin.js";
import { registerHomeRoutes } from "./routes/home.js";
import { registerSupportRoutes } from "./routes/support.js";
import { registerPrescriptionRoutes } from "./routes/prescriptions.js";
import { registerProfileRoutes } from "./routes/profile.js";
import { registerOnboardingRoutes } from "./routes/onboarding.js";
import { registerNotificationRoutes } from "./routes/notifications.js";
import { registerOTPRoutes } from "./routes/otp.js";
import { registerMedicinesRoutes } from "./routes/medicines.js";

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

  // Initialize rate limiting middleware
  createRateLimitMiddleware(app);

  // Initialize Firebase Admin SDK
  initializeFirebaseAdmin();

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
  await registerMedicinesRoutes(app);
  await registerNotificationRoutes(app);
  await registerOTPRoutes(app);

  return app;
}
