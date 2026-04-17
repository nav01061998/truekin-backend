-- Homepage configuration table for dynamic content management
CREATE TABLE homepage_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mode TEXT NOT NULL CHECK (mode IN ('guest', 'authenticated')),
  greeting TEXT NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL,

  -- Top navigation bar
  top_bar_title TEXT NOT NULL,
  top_bar_items JSONB DEFAULT '[]',

  -- Bottom tab bar
  bottom_bar_items JSONB DEFAULT '[]',

  -- Prompt card
  prompt_title TEXT,
  prompt_description TEXT,
  prompt_cta_label TEXT,
  prompt_action_id TEXT,

  -- Section and cards
  section_title TEXT NOT NULL,
  cards JSONB DEFAULT '[]',

  -- Update notification
  update_available BOOLEAN DEFAULT false,
  update_auto_prompt BOOLEAN DEFAULT false,
  update_title TEXT,
  update_description TEXT,
  update_url TEXT,

  -- Metadata
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(mode, is_active)
);

-- Create indexes for faster lookups
CREATE INDEX idx_homepage_config_mode ON homepage_config(mode);
CREATE INDEX idx_homepage_config_active ON homepage_config(is_active);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_homepage_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER homepage_config_updated_at
BEFORE UPDATE ON homepage_config
FOR EACH ROW
EXECUTE FUNCTION update_homepage_config_timestamp();

-- Seed initial configuration for guest mode
INSERT INTO homepage_config (
  mode,
  greeting,
  title,
  subtitle,
  top_bar_title,
  top_bar_items,
  bottom_bar_items,
  section_title,
  cards,
  update_auto_prompt,
  is_active
) VALUES (
  'guest',
  'Welcome to TrueKin',
  'Care is easier when your next step is clear',
  'Sign in to start managing your health and the health of people you care for.',
  'Home',
  '[
    {"id": "notifications", "icon": "notifications", "hPos": 1, "pageName": "/notifications"},
    {"id": "settings", "icon": "settings", "hPos": 0, "pageName": "/settings"}
  ]',
  '[
    {"id": "home", "title": "Home", "activeIcon": "home", "inActiveIcon": "home", "hPos": 0, "pageName": "/(tabs)/home"},
    {"id": "medicines", "title": "Medicines", "activeIcon": "medication", "inActiveIcon": "medication", "hPos": 1, "pageName": "/(tabs)/medicines"},
    {"id": "family", "title": "Family", "activeIcon": "people", "inActiveIcon": "people-outline", "hPos": 2, "pageName": "/(tabs)/family"},
    {"id": "profile", "title": "Profile", "activeIcon": "person", "inActiveIcon": "person-outline", "hPos": 3, "pageName": "/(tabs)/profile"}
  ]',
  'What you can do with TrueKin',
  '[
    {"id": "guest-medicines", "title": "Medicine reminders", "description": "Track your medication and get timely reminders", "icon": "medication", "ctaLabel": "Sign in", "actionId": "sign_in"},
    {"id": "guest-family", "title": "Family health", "description": "Monitor and organize health information for your family members", "icon": "group-add", "ctaLabel": "Sign in", "actionId": "sign_in"}
  ]',
  false,
  true
);

-- Seed initial configuration for authenticated mode
INSERT INTO homepage_config (
  mode,
  greeting,
  title,
  subtitle,
  top_bar_title,
  top_bar_items,
  bottom_bar_items,
  section_title,
  cards,
  update_auto_prompt,
  is_active
) VALUES (
  'authenticated',
  'Welcome back',
  'Care is easier when your next step is clear',
  'Start setting up your medication reminders or add the people you care for.',
  'Home',
  '[
    {"id": "notifications", "icon": "notifications", "hPos": 1, "pageName": "/notifications"},
    {"id": "settings", "icon": "settings", "hPos": 0, "pageName": "/settings"}
  ]',
  '[
    {"id": "home", "title": "Home", "activeIcon": "home", "inActiveIcon": "home", "hPos": 0, "pageName": "/(tabs)/home"},
    {"id": "medicines", "title": "Medicines", "activeIcon": "medication", "inActiveIcon": "medication", "hPos": 1, "pageName": "/(tabs)/medicines"},
    {"id": "family", "title": "Family", "activeIcon": "people", "inActiveIcon": "people-outline", "hPos": 2, "pageName": "/(tabs)/family"},
    {"id": "profile", "title": "Profile", "activeIcon": "person", "inActiveIcon": "person-outline", "hPos": 3, "pageName": "/(tabs)/profile"}
  ]',
  'What you can do with TrueKin',
  '[
    {"id": "auth-medicines", "title": "Medicine reminders", "description": "Want to start adding medicines and set up timely reminders?", "icon": "medication", "ctaLabel": "Start adding medicines", "actionId": "add_medicine"},
    {"id": "auth-family", "title": "Family health", "description": "Add other members and keep their medication details organised.", "icon": "group-add", "ctaLabel": "Add family members", "actionId": "add_family"}
  ]',
  false,
  true
);
