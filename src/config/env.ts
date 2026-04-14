import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.string().default("development"),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  APP_UPDATE_AVAILABLE: z.string().optional().default("false"),
  APP_UPDATE_AUTOPROMPT: z.string().optional().default("false"),
  APP_UPDATE_URL: z.string().optional().default(""),
  MSG91_AUTH_KEY: z.string().optional(),
  MSG91_TEMPLATE_ID: z.string().optional(),
  MSG91_SENDER_ID: z.string().optional().default("TRUEKIN"),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
});

const parsed = envSchema.parse(process.env);

export const env = {
  ...parsed,
  appUpdateAvailable: parsed.APP_UPDATE_AVAILABLE === "true",
  appUpdateAutoprompt: parsed.APP_UPDATE_AUTOPROMPT === "true",
  appUpdateUrl: parsed.APP_UPDATE_URL || null,
};

