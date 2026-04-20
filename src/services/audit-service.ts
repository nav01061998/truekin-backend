import { supabaseAdmin } from "../lib/supabase.js";

export type AuditAction =
  | "PROFILE_UPDATE"
  | "EMAIL_VERIFICATION"
  | "PHONE_CHANGE"
  | "OTP_REQUEST"
  | "OTP_VERIFICATION_ATTEMPT"
  | "ACCOUNT_DELETION";

export interface AuditLogInput {
  userId: string;
  action: AuditAction;
  fieldUpdated?: string[];
  oldValue?: Record<string, any>;
  newValue?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  status: "SUCCESS" | "FAILED";
  errorMessage?: string;
  metadata?: Record<string, any>;
}

/**
 * Log an audit event
 */
export async function logAuditEvent(input: AuditLogInput): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from("profile_audit_logs").insert({
      user_id: input.userId,
      action: input.action,
      field_updated: input.fieldUpdated || null,
      old_value: input.oldValue || null,
      new_value: input.newValue || null,
      ip_address: input.ipAddress || null,
      user_agent: input.userAgent || null,
      status: input.status,
      error_message: input.errorMessage || null,
      metadata: input.metadata || null,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error("Error logging audit event:", error);
      // Don't throw - audit logging should not break the main operation
    }
  } catch (error) {
    console.error("Error in audit logging:", error);
    // Silently fail - audit logging is non-critical
  }
}

/**
 * Get audit logs for a user
 */
export async function getUserAuditLogs(userId: string, limit: number = 50): Promise<any[]> {
  const { data, error } = await supabaseAdmin
    .from("profile_audit_logs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching audit logs:", error);
    return [];
  }

  return data || [];
}

/**
 * Get audit logs by action
 */
export async function getAuditLogsByAction(
  action: AuditAction,
  limit: number = 100
): Promise<any[]> {
  const { data, error } = await supabaseAdmin
    .from("profile_audit_logs")
    .select("*")
    .eq("action", action)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching audit logs:", error);
    return [];
  }

  return data || [];
}

/**
 * Get statistics on profile updates
 */
export async function getProfileUpdateStats(days: number = 30): Promise<{
  totalUpdates: number;
  successfulUpdates: number;
  failedUpdates: number;
  byAction: Record<string, number>;
}> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data, error } = await supabaseAdmin
    .from("profile_audit_logs")
    .select("action, status")
    .gte("created_at", startDate.toISOString());

  if (error) {
    console.error("Error fetching stats:", error);
    return {
      totalUpdates: 0,
      successfulUpdates: 0,
      failedUpdates: 0,
      byAction: {},
    };
  }

  let totalUpdates = 0;
  let successfulUpdates = 0;
  let failedUpdates = 0;
  const byAction: Record<string, number> = {};

  (data || []).forEach((log) => {
    totalUpdates++;
    if (log.status === "SUCCESS") {
      successfulUpdates++;
    } else {
      failedUpdates++;
    }

    if (!byAction[log.action]) {
      byAction[log.action] = 0;
    }
    byAction[log.action]++;
  });

  return {
    totalUpdates,
    successfulUpdates,
    failedUpdates,
    byAction,
  };
}
