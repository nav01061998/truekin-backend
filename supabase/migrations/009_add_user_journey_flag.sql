-- Add user journey selection shown flag to profiles table
ALTER TABLE profiles
ADD COLUMN user_journey_selection_shown BOOLEAN DEFAULT false;

-- Add index for faster lookups
CREATE INDEX idx_profiles_user_journey_shown ON profiles(user_journey_selection_shown);

-- Add comment explaining the field
COMMENT ON COLUMN profiles.user_journey_selection_shown IS 'Flag to track if user journey selection screen has been shown to the user. Used by frontend to avoid showing the screen multiple times.';
