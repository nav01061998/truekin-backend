-- App versions management table
CREATE TABLE app_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  latest_version TEXT NOT NULL,
  minimum_supported_version TEXT NOT NULL,
  update_url TEXT NOT NULL,
  release_notes TEXT NOT NULL,
  release_date DATE NOT NULL,
  changelog JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(platform, is_active)
);

-- Add index for active versions lookup
CREATE INDEX idx_app_versions_platform_active ON app_versions(platform, is_active);

-- Add trigger for updated_at
CREATE TRIGGER set_app_versions_updated_at
  BEFORE UPDATE ON app_versions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Insert initial iOS version
INSERT INTO app_versions (
  platform,
  latest_version,
  minimum_supported_version,
  update_url,
  release_notes,
  release_date,
  changelog,
  is_active
) VALUES (
  'ios',
  '1.0.0',
  '1.0.0',
  'https://apps.apple.com/app/truekin/id123456',
  'Initial release',
  CURRENT_DATE,
  '[
    {
      "version": "1.0.0",
      "date": "2026-04-17",
      "features": ["User onboarding", "Medication tracking", "Health conditions"],
      "bugFixes": []
    }
  ]'::jsonb,
  true
);

-- Insert initial Android version
INSERT INTO app_versions (
  platform,
  latest_version,
  minimum_supported_version,
  update_url,
  release_notes,
  release_date,
  changelog,
  is_active
) VALUES (
  'android',
  '1.0.0',
  '1.0.0',
  'https://play.google.com/store/apps/details?id=com.careloop.truekin',
  'Initial release',
  CURRENT_DATE,
  '[
    {
      "version": "1.0.0",
      "date": "2026-04-17",
      "features": ["User onboarding", "Medication tracking", "Health conditions"],
      "bugFixes": []
    }
  ]'::jsonb,
  true
);
