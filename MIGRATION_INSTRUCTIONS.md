# Database Migration Instructions

## Overview

Three new migrations need to be applied to your Supabase database:
- **012**: Extend user profiles with new fields
- **013**: Create OTP requests table
- **014**: Create audit logs table

---

## Step 1: Connect to Supabase

1. Go to [Supabase Console](https://app.supabase.com)
2. Select your project: `xoznufjoozmrhyuxngiv`
3. Click on **SQL Editor** in the left sidebar

---

## Step 2: Apply Migration 012 - Extend Profile Fields

Copy and paste this SQL:

```sql
-- Migration 012: Extend user profile with additional fields
-- Phase 1: Database Schema Updates for Profile Management

-- Add new columns to profiles table
ALTER TABLE profiles ADD COLUMN address VARCHAR(200) NULL;
ALTER TABLE profiles ADD COLUMN blood_group VARCHAR(4) NULL CHECK (blood_group IN ('O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'));
ALTER TABLE profiles ADD COLUMN height INT NULL CHECK (height > 100 AND height < 250);
ALTER TABLE profiles ADD COLUMN weight INT NULL CHECK (weight > 20 AND weight < 250);
ALTER TABLE profiles ADD COLUMN food_allergies TEXT[] DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN medicine_allergies TEXT[] DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN email VARCHAR(255) UNIQUE NULL;
ALTER TABLE profiles ADD COLUMN email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN completion_percentage INT DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100);

-- Create index for email lookups
CREATE INDEX idx_profiles_email ON profiles(email) WHERE email IS NOT NULL;
CREATE INDEX idx_profiles_email_verified ON profiles(email_verified);
CREATE INDEX idx_profiles_completion_percentage ON profiles(completion_percentage);

-- Add comment for clarity
COMMENT ON TABLE profiles IS 'User profiles with extended health and personal information';
COMMENT ON COLUMN profiles.completion_percentage IS 'Profile completion percentage (0-100) calculated based on filled fields';
```

**Click "Run"** and verify ✅ "Success"

---

## Step 3: Apply Migration 013 - OTP Requests Table

Copy and paste this SQL:

```sql
-- Migration 013: Create OTP requests table for email and phone verification
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
```

**Click "Run"** and verify ✅ "Success"

---

## Step 4: Apply Migration 014 - Audit Logs Table

Copy and paste this SQL:

```sql
-- Migration 014: Create profile audit logs table for compliance and monitoring
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
```

**Click "Run"** and verify ✅ "Success"

---

## Step 5: Verify Migrations

Run this query to confirm all tables exist:

```sql
-- Verify new columns in profiles
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name IN ('address', 'blood_group', 'height', 'weight', 'food_allergies', 'medicine_allergies', 'email', 'email_verified', 'completion_percentage')
ORDER BY column_name;

-- Should return 9 rows
```

Run this to verify new tables:

```sql
-- Verify new tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('otp_requests', 'profile_audit_logs');

-- Should return 2 rows
```

---

## Step 6: Update Backend Migrations Record (Optional)

If you have a migrations table, insert these:

```sql
-- Record migrations as applied (if you track them)
INSERT INTO migrations (name, applied_at) VALUES
  ('012_extend_user_profile_fields', NOW()),
  ('013_create_otp_requests_table', NOW()),
  ('014_create_profile_audit_logs_table', NOW())
ON CONFLICT DO NOTHING;
```

---

## Verification Checklist

- [ ] Migration 012 applied ✅
- [ ] Migration 013 applied ✅
- [ ] Migration 014 applied ✅
- [ ] All tables appear in Supabase
- [ ] All indexes created
- [ ] No SQL errors in console

---

## Rollback (If Needed)

If you need to undo the migrations:

```sql
-- Rollback Migration 014
DROP TABLE IF EXISTS public.profile_audit_logs;

-- Rollback Migration 013
DROP TABLE IF EXISTS public.otp_requests;

-- Rollback Migration 012
ALTER TABLE profiles DROP COLUMN IF EXISTS address;
ALTER TABLE profiles DROP COLUMN IF EXISTS blood_group;
ALTER TABLE profiles DROP COLUMN IF EXISTS height;
ALTER TABLE profiles DROP COLUMN IF EXISTS weight;
ALTER TABLE profiles DROP COLUMN IF EXISTS food_allergies;
ALTER TABLE profiles DROP COLUMN IF EXISTS medicine_allergies;
ALTER TABLE profiles DROP COLUMN IF EXISTS email;
ALTER TABLE profiles DROP COLUMN IF EXISTS email_verified;
ALTER TABLE profiles DROP COLUMN IF EXISTS completion_percentage;

DROP INDEX IF EXISTS idx_profiles_email;
DROP INDEX IF EXISTS idx_profiles_email_verified;
DROP INDEX IF EXISTS idx_profiles_completion_percentage;
```

---

**✅ Migrations complete! Now you can test the backend endpoints.**

See `TESTING_GUIDE.md` for testing instructions.
