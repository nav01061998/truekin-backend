import { supabaseAdmin } from "../lib/supabase.js";
import { assertValidSession, type SessionContext } from "./session-service.js";

export type FamilyMember = {
  id: string;
  user_id: string;
  linked_user_id: string;
  role: "spouse" | "parent" | "child" | "sibling" | "other";
  nickname?: string | null;
  linked_profile?: {
    display_name?: string | null;
    avatar_url?: string | null;
  };
};

export type AddFamilyMemberRequest = {
  linked_user_id: string;
  role: string;
  nickname?: string;
};

/**
 * Get all family members for a user with linked profile information
 */
export async function getFamilyMembers(
  input: {
    userId: string;
    sessionToken: string;
  }
): Promise<FamilyMember[]> {
  // Validate session
  const authUser = await assertValidSession({
    userId: input.userId,
    sessionToken: input.sessionToken,
  });

  // Check if user exists
  const { data: user, error: userError } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("id", input.userId)
    .single();

  if (userError && userError.code !== "PGRST116") {
    throw userError;
  }

  if (!user) {
    throw new Error("User not found");
  }

  // Fetch family members with linked profile data
  const { data: familyMembers, error: familyError } = await supabaseAdmin
    .from("family_links")
    .select(
      "id, user_id, linked_user_id, role, nickname, linked_user:linked_user_id(display_name, avatar_url)"
    )
    .eq("user_id", input.userId);

  if (familyError) {
    console.error("Error fetching family members:", familyError);
    throw new Error(`Failed to fetch family members: ${familyError.message}`);
  }

  // Format response
  const formatted: FamilyMember[] = (familyMembers || []).map((fm: any) => ({
    id: fm.id,
    user_id: fm.user_id,
    linked_user_id: fm.linked_user_id,
    role: fm.role,
    nickname: fm.nickname || null,
    linked_profile: {
      display_name: fm.linked_user?.display_name || null,
      avatar_url: fm.linked_user?.avatar_url || null,
    },
  }));

  return formatted;
}

/**
 * Add a new family member
 */
export async function addFamilyMember(
  input: {
    userId: string;
    sessionToken: string;
    linked_user_id: string;
    role: string;
    nickname?: string;
  }
): Promise<FamilyMember> {
  // Validate session
  const authUser = await assertValidSession({
    userId: input.userId,
    sessionToken: input.sessionToken,
  });

  // Validate required fields
  const linkedUserId = input.linked_user_id?.trim();
  const role = input.role?.trim();
  const nickname = input.nickname?.trim();

  if (!linkedUserId) {
    throw new Error("linked_user_id is required");
  }

  if (!role) {
    throw new Error("role is required");
  }

  // Validate role
  const validRoles = ["spouse", "parent", "child", "sibling", "other"];
  if (!validRoles.includes(role)) {
    throw new Error(`Invalid role. Must be one of: ${validRoles.join(", ")}`);
  }

  // Check if linked user exists
  const { data: linkedUser, error: linkedUserError } = await supabaseAdmin
    .from("profiles")
    .select("id, display_name, avatar_url")
    .eq("id", linkedUserId)
    .single();

  if (linkedUserError && linkedUserError.code !== "PGRST116") {
    throw linkedUserError;
  }

  if (!linkedUser) {
    throw new Error("User with linked_user_id not found");
  }

  // Check if relationship already exists
  const { data: existingRelationship, error: checkError } = await supabaseAdmin
    .from("family_links")
    .select("id")
    .eq("user_id", input.userId)
    .eq("linked_user_id", linkedUserId)
    .maybeSingle();

  if (checkError && checkError.code !== "PGRST116") {
    throw checkError;
  }

  if (existingRelationship) {
    throw new Error("Family relationship already exists");
  }

  // Create family member record
  const familyData = {
    user_id: input.userId,
    linked_user_id: linkedUserId,
    role,
    nickname: nickname || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: newFamilyMember, error: insertError } = await supabaseAdmin
    .from("family_links")
    .insert(familyData)
    .select("*")
    .single();

  if (insertError) {
    console.error("Error adding family member:", insertError);
    throw new Error(`Failed to add family member: ${insertError.message}`);
  }

  if (!newFamilyMember) {
    throw new Error("Failed to add family member: No data returned");
  }

  // Format response
  const result: FamilyMember = {
    id: newFamilyMember.id,
    user_id: newFamilyMember.user_id,
    linked_user_id: newFamilyMember.linked_user_id,
    role: newFamilyMember.role,
    nickname: newFamilyMember.nickname,
    linked_profile: {
      display_name: linkedUser.display_name || null,
      avatar_url: linkedUser.avatar_url || null,
    },
  };

  return result;
}

/**
 * Remove a family member relationship
 */
export async function removeFamilyMember(
  input: {
    userId: string;
    sessionToken: string;
    familyId: string;
  }
): Promise<void> {
  // Validate session
  const authUser = await assertValidSession({
    userId: input.userId,
    sessionToken: input.sessionToken,
  });

  // Validate that family relationship belongs to user
  const { data: familyMember, error: fetchError } = await supabaseAdmin
    .from("family_links")
    .select("id, user_id")
    .eq("id", input.familyId)
    .single();

  if (fetchError && fetchError.code !== "PGRST116") {
    throw fetchError;
  }

  if (!familyMember) {
    throw new Error("Family relationship not found");
  }

  if (familyMember.user_id !== input.userId) {
    throw new Error("Unauthorized to remove this family member");
  }

  // Delete the relationship
  const { error: deleteError } = await supabaseAdmin
    .from("family_links")
    .delete()
    .eq("id", input.familyId);

  if (deleteError) {
    console.error("Error removing family member:", deleteError);
    throw new Error(`Failed to remove family member: ${deleteError.message}`);
  }
}
