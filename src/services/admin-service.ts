import { supabaseAdmin } from "../lib/supabase.js";
import { assertValidSession, type SessionContext } from "./session-service.js";

/**
 * Check if user has a specific role
 */
export async function userHasRole(userId: string, role: "admin" | "moderator" | "user"): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role", role)
      .maybeSingle();

    if (error) {
      console.error("Error checking user role:", error);
      return false;
    }

    return !!data;
  } catch (error) {
    console.error("User role check error:", error);
    return false;
  }
}

/**
 * Verify user session and check if they have admin role
 * Throws error if not authenticated or not admin
 */
export async function requireAdminRole(input: SessionContext): Promise<string> {
  // First validate session
  const authUser = await assertValidSession(input);

  // Then check admin role
  const isAdmin = await userHasRole(authUser.id, "admin");

  if (!isAdmin) {
    throw new Error("Admin access required. User does not have admin role.");
  }

  return authUser.id;
}

/**
 * Get all user roles
 */
export async function getUserRoles(userId: string): Promise<string[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (error) {
      console.error("Error fetching user roles:", error);
      return [];
    }

    return (data || []).map((row: { role: string }) => row.role);
  } catch (error) {
    console.error("Error getting user roles:", error);
    return [];
  }
}

/**
 * Grant admin role to user (requires admin session)
 */
export async function grantAdminRole(
  adminContext: SessionContext,
  targetUserId: string
): Promise<void> {
  // Verify requester is admin
  await requireAdminRole(adminContext);

  // Grant role to target user
  const { error } = await supabaseAdmin.rpc("grant_user_role", {
    p_user_id: targetUserId,
    p_role: "admin",
    p_granted_by: adminContext.userId,
  });

  if (error) {
    console.error("Error granting admin role:", error);
    throw new Error(`Failed to grant admin role: ${error.message}`);
  }
}

/**
 * Revoke admin role from user (requires admin session)
 */
export async function revokeAdminRole(
  adminContext: SessionContext,
  targetUserId: string
): Promise<void> {
  // Verify requester is admin
  await requireAdminRole(adminContext);

  // Revoke role from target user
  const { error } = await supabaseAdmin.rpc("revoke_user_role", {
    p_user_id: targetUserId,
    p_role: "admin",
  });

  if (error) {
    console.error("Error revoking admin role:", error);
    throw new Error(`Failed to revoke admin role: ${error.message}`);
  }
}

/**
 * List all admin users
 */
export async function listAdminUsers(): Promise<Array<{ userId: string; email: string; grantedAt: string }>> {
  try {
    const { data, error } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, granted_at")
      .eq("role", "admin");

    if (error) {
      console.error("Error listing admin users:", error);
      return [];
    }

    // Get user emails
    const admins: Array<{ userId: string; email: string; grantedAt: string }> = [];

    if (data) {
      for (const record of data) {
        try {
          const { data: userData } = await supabaseAdmin.auth.admin.getUserById(record.user_id);
          if (userData?.user?.email) {
            admins.push({
              userId: record.user_id,
              email: userData.user.email,
              grantedAt: record.granted_at,
            });
          }
        } catch (err) {
          console.error(`Error fetching user ${record.user_id}:`, err);
        }
      }
    }

    return admins;
  } catch (error) {
    console.error("Error listing admin users:", error);
    return [];
  }
}
