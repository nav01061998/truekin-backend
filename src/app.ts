import Fastify from "fastify";
import cors from "@fastify/cors";
import { registerHealthRoutes } from "./routes/health.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerHomeRoutes } from "./routes/home.js";
import { registerSupportRoutes } from "./routes/support.js";
import { registerPrescriptionRoutes } from "./routes/prescriptions.js";

export async function buildApp() {
  const app = Fastify({
    logger: true,
  });

  await app.register(cors, {
    origin: true,
  });

  await registerHealthRoutes(app);
  await registerAuthRoutes(app);
  await registerHomeRoutes(app);
  await registerSupportRoutes(app);
  await registerPrescriptionRoutes(app);

  return app;
}

