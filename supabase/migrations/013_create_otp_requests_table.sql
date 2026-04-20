-- Migration: Create OTP requests table for email and phone verification
-- Phase 1: OTP Management Database Schema

CREATE TABLE public.otp_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NULL,
  phone VARCHAR(20) NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('EMAIL_VERIFICATION', 'PHONE_CHANGE')),
  otp_code VARCHAR(255) NOT NULL, -- hashed OTP
  attempt_count INT DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts INT DEFAULT 5 CHECK (max_attempts > 0),
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified_at TIMESTAMP WITH TIME ZONE NULL
);

-- Create indexes for efficient queries
CREATE INDEX idx_otp_requests_user_id ON public.otp_requests(user_id);
CREATE INDEX idx_otp_requests_user_type ON public.otp_requests(user_id, type);
CREATE INDEX idx_otp_requests_email_type ON public.otp_requests(email, type) WHERE email IS NOT NULL;
CREATE INDEX idx_otp_requests_phone_type ON public.otp_requests(phone, type) WHERE phone IS NOT NULL;
CREATE INDEX idx_otp_requests_expires_at ON public.otp_requests(expires_at);
CREATE INDEX idx_otp_requests_is_verified ON public.otp_requests(is_verified);

-- Add comments
COMMENT ON TABLE public.otp_requests IS 'Stores OTP requests for email verification and phone number changes';
COMMENT ON COLUMN public.otp_requests.otp_code IS 'OTP code stored as hash (never store plain text)';
COMMENT ON COLUMN public.otp_requests.type IS 'Type of OTP request: EMAIL_VERIFICATION or PHONE_CHANGE';
COMMENT ON COLUMN public.otp_requests.expires_at IS 'OTP expiration timestamp (typically 10 minutes from creation)';
