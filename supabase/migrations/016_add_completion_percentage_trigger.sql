-- Migration 016: Add automatic completion_percentage calculation

-- Create function to calculate profile completion percentage
-- Matches the JavaScript calculateCompletionPercentage logic
-- Personal Information (50%): display_name, gender, date_of_birth, email+verified, address
-- Health Information (50%): health_conditions, blood_group, height, weight, allergies
CREATE OR REPLACE FUNCTION calculate_profile_completion_percentage(profile_id UUID)
RETURNS INTEGER AS $$
DECLARE
  percentage INT := 0;
  p_record RECORD;
BEGIN
  -- Get the profile
  SELECT * INTO p_record FROM profiles WHERE id = profile_id;

  IF p_record IS NULL THEN
    RETURN 0;
  END IF;

  -- Personal Information (50%)
  IF p_record.display_name IS NOT NULL AND TRIM(p_record.display_name) != '' THEN
    percentage := percentage + 10;
  END IF;

  IF p_record.gender IS NOT NULL THEN
    percentage := percentage + 10;
  END IF;

  IF p_record.date_of_birth IS NOT NULL THEN
    percentage := percentage + 10;
  END IF;

  IF p_record.email IS NOT NULL AND p_record.email_verified = TRUE THEN
    percentage := percentage + 10;
  END IF;

  IF p_record.address IS NOT NULL AND TRIM(p_record.address) != '' AND LENGTH(TRIM(p_record.address)) >= 10 THEN
    percentage := percentage + 10;
  END IF;

  -- Health Information (50%)
  IF p_record.health_conditions IS NOT NULL AND ARRAY_LENGTH(p_record.health_conditions, 1) > 0 THEN
    percentage := percentage + 10;
  END IF;

  IF p_record.blood_group IS NOT NULL THEN
    percentage := percentage + 10;
  END IF;

  IF p_record.height IS NOT NULL AND p_record.height > 100 AND p_record.height < 250 THEN
    percentage := percentage + 10;
  END IF;

  IF p_record.weight IS NOT NULL AND p_record.weight > 20 AND p_record.weight < 250 THEN
    percentage := percentage + 10;
  END IF;

  IF (p_record.food_allergies IS NOT NULL AND ARRAY_LENGTH(p_record.food_allergies, 1) > 0) OR
     (p_record.medicine_allergies IS NOT NULL AND ARRAY_LENGTH(p_record.medicine_allergies, 1) > 0) THEN
    percentage := percentage + 10;
  END IF;

  -- Return percentage clamped to 0-100
  RETURN GREATEST(0, LEAST(100, percentage));
END;
$$ LANGUAGE plpgsql;

-- Create trigger function to update completion_percentage on profile update
CREATE OR REPLACE FUNCTION update_profile_completion_percentage()
RETURNS TRIGGER AS $$
BEGIN
  NEW.completion_percentage := calculate_profile_completion_percentage(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_update_profile_completion ON profiles;

-- Create trigger to automatically update completion_percentage
CREATE TRIGGER trigger_update_profile_completion
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION update_profile_completion_percentage();

-- Also update completion_percentage on insert
DROP TRIGGER IF EXISTS trigger_insert_profile_completion ON profiles;

CREATE TRIGGER trigger_insert_profile_completion
AFTER INSERT ON profiles
FOR EACH ROW
EXECUTE FUNCTION update_profile_completion_percentage();

-- Update existing profiles with their completion percentage
UPDATE profiles 
SET completion_percentage = calculate_profile_completion_percentage(id)
WHERE completion_percentage = 0 OR completion_percentage IS NULL;

COMMENT ON FUNCTION calculate_profile_completion_percentage(UUID) IS 'Calculates profile completion percentage with weighted scoring. Personal Info (50%): display_name, gender, date_of_birth, email+verified, address. Health Info (50%): health_conditions, blood_group, height, weight, food/medicine allergies. Each category worth 10%.';

COMMENT ON FUNCTION update_profile_completion_percentage() IS 'Trigger function to automatically update completion_percentage when profile is updated or inserted';
