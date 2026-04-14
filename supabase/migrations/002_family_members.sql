-- ============================================
-- FAMILY MEMBERS (managed by a caregiver)
-- ============================================
-- Stores family members added by a user during onboarding.
-- Unlike family_links (which requires both users to have accounts),
-- this table allows adding members who may not have signed up yet.
-- When a family member signs up with their phone number,
-- they can be linked via the phone column.

CREATE TABLE family_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  added_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  gender TEXT CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
  relation TEXT NOT NULL CHECK (relation IN ('parent', 'spouse', 'child', 'sibling', 'grandparent', 'other')),
  linked_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;

-- Users can only see family members they added
CREATE POLICY "Users can view own family members"
  ON family_members FOR SELECT
  USING (auth.uid() = added_by);

-- Users can insert their own family members
CREATE POLICY "Users can insert own family members"
  ON family_members FOR INSERT
  WITH CHECK (auth.uid() = added_by);

-- Users can update their own family members
CREATE POLICY "Users can update own family members"
  ON family_members FOR UPDATE
  USING (auth.uid() = added_by);

-- Users can delete their own family members
CREATE POLICY "Users can delete own family members"
  ON family_members FOR DELETE
  USING (auth.uid() = added_by);

-- Add family_member_id to medications table so medicines can be
-- associated with a family member managed by the current user
ALTER TABLE medications
  ADD COLUMN family_member_id UUID REFERENCES family_members(id) ON DELETE SET NULL;
