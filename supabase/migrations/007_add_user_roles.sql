-- Add roles table for user permissions
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'admin', 'moderator')),
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  granted_by UUID REFERENCES auth.users(id),
  UNIQUE(user_id, role)
);

-- Add index for quick role lookup
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role ON user_roles(role);

-- Helper function to check if user has a role
CREATE OR REPLACE FUNCTION user_has_role(
  p_user_id UUID,
  p_role TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1 FROM user_roles
    WHERE user_id = p_user_id AND role = p_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to grant role to user
CREATE OR REPLACE FUNCTION grant_user_role(
  p_user_id UUID,
  p_role TEXT,
  p_granted_by UUID DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  INSERT INTO user_roles (user_id, role, granted_by)
  VALUES (p_user_id, p_role, p_granted_by)
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to revoke role from user
CREATE OR REPLACE FUNCTION revoke_user_role(
  p_user_id UUID,
  p_role TEXT
) RETURNS VOID AS $$
BEGIN
  DELETE FROM user_roles
  WHERE user_id = p_user_id AND role = p_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert initial admin user (if they exist)
-- Run this manually after user is created:
-- SELECT grant_user_role('user-uuid', 'admin');
