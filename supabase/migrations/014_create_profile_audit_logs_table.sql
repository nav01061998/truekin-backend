-- Migration: Create profile audit logs table for compliance and monitoring
-- Phase 1: Audit Logging Database Schema

CREATE TABLE public.profile_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  field_updated TEXT[] NULL, -- Array of field names that were updated
  old_value JSONB NULL,
  new_value JSONB NULL,
  ip_address VARCHAR(45) NULL,
  user_agent TEXT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('SUCCESS', 'FAILED')),
  error_message TEXT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB NULL
);

-- Create indexes for efficient queries
CREATE INDEX idx_profile_audit_logs_user_id ON public.profile_audit_logs(user_id);
CREATE INDEX idx_profile_audit_logs_action ON public.profile_audit_logs(action);
CREATE INDEX idx_profile_audit_logs_created_at ON public.profile_audit_logs(created_at);
CREATE INDEX idx_profile_audit_logs_status ON public.profile_audit_logs(status);
CREATE INDEX idx_profile_audit_logs_user_created ON public.profile_audit_logs(user_id, created_at);

-- Add comments
COMMENT ON TABLE public.profile_audit_logs IS 'Audit logs for all profile-related operations for compliance and security monitoring';
COMMENT ON COLUMN public.profile_audit_logs.action IS 'Type of action: PROFILE_UPDATE, EMAIL_VERIFICATION, PHONE_CHANGE, OTP_REQUEST, OTP_VERIFICATION_ATTEMPT';
COMMENT ON COLUMN public.profile_audit_logs.field_updated IS 'Array of field names that were updated';
COMMENT ON COLUMN public.profile_audit_logs.old_value IS 'Previous values of updated fields (JSON)';
COMMENT ON COLUMN public.profile_audit_logs.new_value IS 'New values of updated fields (JSON)';
COMMENT ON COLUMN public.profile_audit_logs.status IS 'Status of the action: SUCCESS or FAILED';
