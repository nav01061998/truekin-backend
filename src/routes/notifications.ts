import type { FastifyInstance } from "fastify";
import { z, ZodError } from "zod";
import { supabaseAdmin } from "../lib/supabase.js";
import { getFirebaseFirestore } from "../lib/firebase.js";
import { assertValidSession } from "../services/session-service.js";

function readHeader(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return undefined;
}

function getAuthFromRequest(request: { headers: Record<string, unknown> }) {
  return {
    userId:
      readHeader(request.headers["x-user-id"]) ||
      readHeader(request.headers["X-User-Id"]),
    sessionToken:
      readHeader(request.headers["x-session-token"]) ||
      readHeader(request.headers["X-Session-Token"]),
  };
}

const registerDeviceSchema = z.object({
  device_token: z.string().min(10),
  platform: z.enum(["ios", "android"]),
});

const unregisterDeviceSchema = z.object({
  device_token: z.string().min(10),
});

export async function registerNotificationRoutes(app: FastifyInstance) {
  // Register device token
  app.post("/v1/notifications/device-token/register", async (request, reply) => {
    try {
      const body = registerDeviceSchema.parse(request.body);
      const { userId, sessionToken } = getAuthFromRequest(request);

      if (!userId || !sessionToken) {
        return reply.code(401).send({
          success: false,
          error: "Unauthorized",
        });
      }

      // Validate session
      await assertValidSession({ userId, sessionToken });

      // Store in PostgreSQL
      const { error: dbError } = await supabaseAdmin
        .from("user_devices")
        .upsert(
          {
            user_id: userId,
            device_token: body.device_token,
            platform: body.platform,
            active: true,
            last_seen: new Date().toISOString(),
          },
          { onConflict: "user_id,device_token" }
        );

      if (dbError) {
        console.error("Error registering device in PostgreSQL:", dbError);
        return reply.code(400).send({
          success: false,
          error: `Failed to register device: ${dbError.message}`,
        });
      }

      // Also store in Firestore for real-time updates
      try {
        const firestore = getFirebaseFirestore();
        const token_hash = Buffer.from(body.device_token)
          .toString("base64")
          .substring(0, 50);

        await firestore
          .collection("users")
          .doc(userId)
          .collection("devices")
          .doc(token_hash)
          .set(
            {
              token: body.device_token,
              platform: body.platform,
              push_enabled: true,
              active: true,
              last_seen: new Date(),
            },
            { merge: true }
          );

        console.log(
          `[Firebase] Device token registered for user ${userId} on ${body.platform}`
        );
      } catch (firebaseError) {
        console.error("Error registering device in Firestore:", firebaseError);
        // Don't fail the request if Firestore fails, as PostgreSQL is primary
      }

      return {
        success: true,
        message: "Device token registered successfully",
      };
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.code(400).send({
          success: false,
          error: "Invalid request body",
          issues: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        });
      }

      console.error("Error in register device endpoint:", error);
      return reply.code(400).send({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to register device",
      });
    }
  });

  // Unregister device token
  app.post("/v1/notifications/device-token/unregister", async (request, reply) => {
    try {
      const body = unregisterDeviceSchema.parse(request.body);
      const { userId, sessionToken } = getAuthFromRequest(request);

      if (!userId || !sessionToken) {
        return reply.code(401).send({
          success: false,
          error: "Unauthorized",
        });
      }

      // Validate session
      await assertValidSession({ userId, sessionToken });

      // Remove from PostgreSQL
      const { error: dbError } = await supabaseAdmin
        .from("user_devices")
        .delete()
        .eq("user_id", userId)
        .eq("device_token", body.device_token);

      if (dbError) {
        console.error("Error unregistering device from PostgreSQL:", dbError);
        return reply.code(400).send({
          success: false,
          error: `Failed to unregister device: ${dbError.message}`,
        });
      }

      // Also remove from Firestore
      try {
        const firestore = getFirebaseFirestore();
        const token_hash = Buffer.from(body.device_token)
          .toString("base64")
          .substring(0, 50);

        await firestore
          .collection("users")
          .doc(userId)
          .collection("devices")
          .doc(token_hash)
          .delete();

        console.log(
          `[Firebase] Device token unregistered for user ${userId}`
        );
      } catch (firebaseError) {
        console.error("Error unregistering device from Firestore:", firebaseError);
        // Don't fail the request if Firestore fails, as PostgreSQL is primary
      }

      return {
        success: true,
        message: "Device token unregistered successfully",
      };
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.code(400).send({
          success: false,
          error: "Invalid request body",
          issues: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        });
      }

      console.error("Error in unregister device endpoint:", error);
      return reply.code(400).send({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to unregister device",
      });
    }
  });
}
