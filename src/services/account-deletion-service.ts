import { supabaseAdmin } from "../lib/supabase.js";
import { assertValidSession, type SessionContext } from "./session-service.js";

export type DeletionReason =
  | "dont_want_to_use"
  | "using_another_account"
  | "too_many_notifications"
  | "app_not_working"
  | "other";

export interface DeleteAccountInput extends SessionContext {
  reason: DeletionReason;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Validate deletion reason
 */
function isValidDeletionReason(reason: string): reason is DeletionReason {
  const validReasons: DeletionReason[] = [
    "dont_want_to_use",
    "using_another_account",
    "too_many_notifications",
    "app_not_working",
    "other",
  ];
  return validReasons.includes(reason as DeletionReason);
}

/**
 * Delete user account and all related data
 *
 * This function:
 * 1. Validates the session
 * 2. Logs the deletion request to audit table
 * 3. Deletes all related data (cascading deletes handled by database)
 * 4. Deletes the user from auth.users
 *
 * Cascading deletes (handled by database ON DELETE CASCADE):
 * - profiles → deleted when user is deleted
 * - auth_sessions → deleted when user is deleted
 * - user_roles → deleted when user is deleted
 * - medications → deleted when user is deleted (if foreign key exists)
 * - reminders → deleted when user is deleted (if foreign key exists)
 * - family_members → deleted when user is deleted (if foreign key exists)
 * - health_records → deleted when user is deleted (if foreign key exists)
 */
export async function deleteUserAccount(input: DeleteAccountInput): Promise<void> {
  // Validate session
  const authUser = await assertValidSession({
    userId: input.userId,
    sessionToken: input.sessionToken,
  });

  const userId = authUser.id;

  // Validate deletion reason
  if (!isValidDeletionReason(input.reason)) {
    throw new Error("Invalid deletion reason");
  }

  // Get user phone for audit log
  const { data: profileData } = await supabaseAdmin
    .from("profiles")
    .select("phone")
    .eq("id", userId)
    .single();

  const userPhone = profileData?.phone || null;

  // Log deletion to audit table BEFORE deleting data
  const { error: auditError } = await supabaseAdmin.from("account_deletions").insert({
    user_id: userId,
    user_phone: userPhone,
    deletion_reason: input.reason,
    ip_address: input.ipAddress || null,
    user_agent: input.userAgent || null,
  });

  if (auditError) {
    console.error("Error logging account deletion:", auditError);
    throw new Error(`Failed to log deletion: ${auditError.message}`);
  }

  // Delete user from auth.users (this cascades to profiles and other related data)
  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

  if (deleteError) {
    console.error("Error deleting user:", deleteError);
    throw new Error(`Failed to delete account: ${deleteError.message}`);
  }

  console.log(`[AUDIT] User ${userId} deleted for reason: ${input.reason}`);
}

/**
 * Get deletion audit logs (for admin purposes)
 */
export async function getDeletionAuditLogs(filters?: {
  startDate?: Date;
  endDate?: Date;
  reason?: DeletionReason;
}): Promise<
  Array<{
    id: string;
    user_id: string;
    user_phone: string;
    deletion_reason: string;
    deleted_at: string;
  }>
> {
  let query = supabaseAdmin.from("account_deletions").select("id, user_id, user_phone, deletion_reason, deleted_at");

  if (filters?.startDate) {
    query = query.gte("deleted_at", filters.startDate.toISOString());
  }

  if (filters?.endDate) {
    query = query.lte("deleted_at", filters.endDate.toISOString());
  }

  if (filters?.reason) {
    query = query.eq("deletion_reason", filters.reason);
  }

  const { data, error } = await query.order("deleted_at", { ascending: false });

  if (error) {
    console.error("Error fetching deletion logs:", error);
    throw new Error(`Failed to fetch deletion logs: ${error.message}`);
  }

  return data || [];
}

/**
 * Get deletion statistics (for analytics)
 */
export async function getDeletionStatistics(
  days: number = 30
): Promise<{
  total_deletions: number;
  by_reason: Record<DeletionReason, number>;
  daily_trend: Array<{ date: string; count: number }>;
}> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Get all deletions in period
  const { data: deletions, error } = await supabaseAdmin
    .from("account_deletions")
    .select("deletion_reason, deleted_at")
    .gte("deleted_at", startDate.toISOString());

  if (error) {
    console.error("Error fetching deletion statistics:", error);
    throw new Error(`Failed to fetch statistics: ${error.message}`);
  }

  // Count by reason
  const byReason: Record<DeletionReason, number> = {
    dont_want_to_use: 0,
    using_another_account: 0,
    too_many_notifications: 0,
    app_not_working: 0,
    other: 0,
  };

  // Calculate daily trend
  const dailyMap = new Map<string, number>();

  (deletions || []).forEach((deletion) => {
    const reason = deletion.deletion_reason as DeletionReason;
    byReason[reason]++;

    const date = new Date(deletion.deleted_at).toISOString().split("T")[0];
    dailyMap.set(date, (dailyMap.get(date) || 0) + 1);
  });

  const dailyTrend = Array.from(dailyMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    total_deletions: deletions?.length || 0,
    by_reason: byReason,
    daily_trend: dailyTrend,
  };
}
