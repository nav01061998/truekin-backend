-- Account deletion audit log table
CREATE TABLE account_deletions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  user_phone VARCHAR(20),
  deletion_reason TEXT NOT NULL CHECK (deletion_reason IN (
    'dont_want_to_use',
    'using_another_account',
    'too_many_notifications',
    'app_not_working',
    'other'
  )),
  additional_feedback TEXT,
  deleted_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address VARCHAR(45),
  user_agent TEXT
);

-- Create indexes for audit trail queries
CREATE INDEX idx_account_deletions_user_id ON account_deletions(user_id);
CREATE INDEX idx_account_deletions_deleted_at ON account_deletions(deleted_at);
CREATE INDEX idx_account_deletions_reason ON account_deletions(deletion_reason);

-- Add comment explaining the table
COMMENT ON TABLE account_deletions IS 'Audit log for deleted accounts. Records user deletion reason and timestamp for compliance and analytics.';
COMMENT ON COLUMN account_deletions.user_id IS 'ID of the deleted user';
COMMENT ON COLUMN account_deletions.user_phone IS 'Phone number of deleted user (stored for reference)';
COMMENT ON COLUMN account_deletions.deletion_reason IS 'Reason provided by user for deletion';
COMMENT ON COLUMN account_deletions.deleted_at IS 'Timestamp of deletion';
COMMENT ON COLUMN account_deletions.ip_address IS 'IP address from which deletion was requested';
COMMENT ON COLUMN account_deletions.user_agent IS 'User agent from deletion request';
