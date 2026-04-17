-- Add onboarding fields to profiles table
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS health_conditions JSONB DEFAULT '[]';

-- Add index for date_of_birth
CREATE INDEX IF NOT EXISTS idx_profiles_date_of_birth ON profiles(date_of_birth);
