-- ============================================
-- PRESCRIPTIONS (Unified Documents System)
-- ============================================
CREATE TABLE medical_prescriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  medication_name TEXT NOT NULL,
  dosage TEXT NOT NULL,
  frequency TEXT NOT NULL,
  duration TEXT,
  prescribed_by TEXT NOT NULL,
  prescribed_date DATE NOT NULL,
  valid_until DATE,
  pharmacy TEXT,
  side_effects TEXT[],
  refills_remaining INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'filled', 'pending')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- MEDICAL REPORTS
-- ============================================
CREATE TABLE medical_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL,
  report_title TEXT NOT NULL,
  report_category TEXT NOT NULL,
  test_date DATE NOT NULL,
  report_date DATE NOT NULL,
  facility TEXT NOT NULL,
  performed_by TEXT NOT NULL,
  referred_by TEXT,
  normal_values JSONB,
  report_values JSONB,
  summary TEXT,
  recommendations TEXT[],
  attachment_url TEXT,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'pending', 'reviewed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX medical_prescriptions_user_id_idx ON medical_prescriptions(user_id);
CREATE INDEX medical_prescriptions_status_idx ON medical_prescriptions(status);
CREATE INDEX medical_prescriptions_prescribed_date_idx ON medical_prescriptions(prescribed_date);

CREATE INDEX medical_reports_user_id_idx ON medical_reports(user_id);
CREATE INDEX medical_reports_status_idx ON medical_reports(status);
CREATE INDEX medical_reports_test_date_idx ON medical_reports(test_date);
CREATE INDEX medical_reports_report_category_idx ON medical_reports(report_category);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE medical_prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_reports ENABLE ROW LEVEL SECURITY;

-- Prescriptions: Users can only see their own
CREATE POLICY "Users can view own prescriptions"
  ON medical_prescriptions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own prescriptions"
  ON medical_prescriptions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own prescriptions"
  ON medical_prescriptions FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own prescriptions"
  ON medical_prescriptions FOR DELETE
  USING (user_id = auth.uid());

-- Reports: Users can only see their own
CREATE POLICY "Users can view own reports"
  ON medical_reports FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own reports"
  ON medical_reports FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own reports"
  ON medical_reports FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own reports"
  ON medical_reports FOR DELETE
  USING (user_id = auth.uid());
