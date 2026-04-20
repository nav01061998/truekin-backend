import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

let firebaseAdminInitialized = false;
let firebaseAdmin: admin.app.App | null = null;

/**
 * Initialize Firebase Admin SDK
 *
 * Supports two initialization methods:
 * 1. File path via FIREBASE_ADMIN_SDK_KEY environment variable
 * 2. Individual environment variables for cloud deployments
 */
export function initializeFirebaseAdmin() {
  if (firebaseAdminInitialized && firebaseAdmin) {
    return firebaseAdmin;
  }

  try {
    let serviceAccount: any;

    // Method 1: Load from file
    const sdkKeyPath = process.env.FIREBASE_ADMIN_SDK_KEY;
    if (sdkKeyPath) {
      const resolvedPath = path.isAbsolute(sdkKeyPath) ? sdkKeyPath : path.resolve(sdkKeyPath);
      if (fs.existsSync(resolvedPath)) {
        const fileContent = fs.readFileSync(resolvedPath, "utf8");
        serviceAccount = JSON.parse(fileContent);
      }
    }

    // Method 2: Load from environment variables (cloud deployments)
    if (!serviceAccount) {
      if (
        !process.env.FIREBASE_PROJECT_ID ||
        !process.env.FIREBASE_CLIENT_EMAIL ||
        !process.env.FIREBASE_PRIVATE_KEY
      ) {
        throw new Error(
          "Firebase credentials not found. Set FIREBASE_ADMIN_SDK_KEY or Firebase environment variables."
        );
      }

      serviceAccount = {
        type: "service_account",
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID,
        auth_uri: "https://accounts.google.com/o/oauth2/auth",
        token_uri: "https://oauth2.googleapis.com/token",
        auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
        client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
      };
    }

    // Initialize Firebase Admin SDK
    firebaseAdmin = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID || "truekin-74608",
    });

    firebaseAdminInitialized = true;

    return firebaseAdmin;
  } catch (error) {
    console.error("[Firebase] Failed to initialize Firebase Admin SDK:", error);
    throw error;
  }
}

/**
 * Get Firebase Admin instance
 */
export function getFirebaseAdmin(): admin.app.App {
  if (!firebaseAdminInitialized || !firebaseAdmin) {
    return initializeFirebaseAdmin();
  }
  return firebaseAdmin;
}

/**
 * Get Firebase Messaging instance
 */
export function getFirebaseMessaging(): admin.messaging.Messaging {
  const app = getFirebaseAdmin();
  return admin.messaging(app);
}

/**
 * Get Firebase Firestore instance
 */
export function getFirebaseFirestore(): admin.firestore.Firestore {
  const app = getFirebaseAdmin();
  return admin.firestore(app);
}

/**
 * Send push notification to device tokens
 */
export async function sendPushNotification(
  tokens: string[],
  notification: {
    title: string;
    body: string;
  },
  data?: Record<string, string>
): Promise<admin.messaging.BatchResponse> {
  if (tokens.length === 0) {
    throw new Error("No device tokens provided");
  }

  const messaging = getFirebaseMessaging();

  const message = {
    notification,
    data: {
      ...data,
      timestamp: new Date().toISOString(),
    },
    android: {
      priority: "high",
      ttl: 86400, // 24 hours in seconds
    },
    apns: {
      headers: {
        "apns-priority": "10",
      },
    },
  };

  try {
    const response = await messaging.sendMulticast({
      tokens,
      ...message,
    } as any);

    console.log(`[Firebase] Sent push notification to ${response.successCount} devices`);

    if (response.failureCount > 0) {
      console.warn(`[Firebase] Failed to send to ${response.failureCount} devices`);
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          console.warn(`[Firebase] Failed token ${tokens[idx]}: ${resp.error?.message}`);
        }
      });
    }

    return response;
  } catch (error) {
    console.error("[Firebase] Error sending push notification:", error);
    throw error;
  }
}

/**
 * Send push notification to a user (via Firestore)
 */
export async function sendPushNotificationToUser(
  userId: string,
  notification: {
    title: string;
    body: string;
  },
  data?: Record<string, string>
): Promise<admin.messaging.BatchResponse> {
  const firestore = getFirebaseFirestore();

  // Get all active devices for this user
  const devicesSnapshot = await firestore
    .collection("users")
    .doc(userId)
    .collection("devices")
    .where("active", "==", true)
    .where("push_enabled", "==", true)
    .get();

  const tokens: string[] = [];
  devicesSnapshot.forEach((doc) => {
    const deviceData = doc.data();
    if (deviceData.token) {
      tokens.push(deviceData.token);
    }
  });

  if (tokens.length === 0) {
    console.log(`[Firebase] No active devices for user ${userId}`);
    return {
      responses: [],
      successCount: 0,
      failureCount: 0,
    } as any;
  }

  return sendPushNotification(tokens, notification, data);
}
