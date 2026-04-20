-- Migration: Extend user profile with additional fields
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
