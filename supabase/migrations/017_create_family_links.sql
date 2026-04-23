-- ============================================
-- FAMILY LINKS (bidirectional user relationships)
-- ============================================
-- Stores relationships between users who are family members.
-- This table allows users to link with other users as family members.

CREATE TABLE family_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  linked_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('spouse', 'parent', 'child', 'sibling', 'other')),
  nickname TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, linked_user_id)
);

-- RLS
ALTER TABLE family_links ENABLE ROW LEVEL SECURITY;

-- Users can only see their own family links
CREATE POLICY "Users can view own family links"
  ON family_links FOR SELECT
  USING (user_id = auth.uid());

-- Users can insert their own family links
CREATE POLICY "Users can insert own family links"
  ON family_links FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own family links
CREATE POLICY "Users can update own family links"
  ON family_links FOR UPDATE
  USING (user_id = auth.uid());

-- Users can delete their own family links
CREATE POLICY "Users can delete own family links"
  ON family_links FOR DELETE
  USING (user_id = auth.uid());

-- Create indexes for performance
CREATE INDEX family_links_user_id_idx ON family_links(user_id);
CREATE INDEX family_links_linked_user_id_idx ON family_links(linked_user_id);
