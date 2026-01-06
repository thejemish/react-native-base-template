-- Create ad_configurations table
-- This table stores ad unit IDs for different ad types, screens, and platforms
CREATE TABLE IF NOT EXISTS ad_configurations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  screen_name VARCHAR(100) NOT NULL,
  ad_type VARCHAR(50) NOT NULL,
  platform VARCHAR(20) NOT NULL DEFAULT 'android',
  ad_unit_id VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(screen_name, ad_type, platform)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_ad_configurations_screen_type_platform ON ad_configurations(screen_name, ad_type, platform);
CREATE INDEX IF NOT EXISTS idx_ad_configurations_active ON ad_configurations(is_active);
CREATE INDEX IF NOT EXISTS idx_ad_configurations_platform ON ad_configurations(platform);

-- Insert default configurations
-- Global ad types (no specific screen) - Android
INSERT INTO ad_configurations (screen_name, ad_type, platform, ad_unit_id, is_active) VALUES
('global', 'app_open', 'android', 'ca-app-pub-7784498406462291/1171261844', true),
('global', 'interstitial', 'android', 'ca-app-pub-7784498406462291/1171261844', true),
('global', 'rewarded', 'android', 'ca-app-pub-7784498406462291/1171261844', true),
('global', 'rewarded_interstitial', 'android', 'ca-app-pub-7784498406462291/1171261844', true)
ON CONFLICT (screen_name, ad_type, platform) DO NOTHING;

-- Global ad types (no specific screen) - iOS
INSERT INTO ad_configurations (screen_name, ad_type, platform, ad_unit_id, is_active) VALUES
('global', 'app_open', 'ios', 'ca-app-pub-7784498406462291/1171261844', true),
('global', 'interstitial', 'ios', 'ca-app-pub-7784498406462291/1171261844', true),
('global', 'rewarded', 'ios', 'ca-app-pub-7784498406462291/1171261844', true),
('global', 'rewarded_interstitial', 'ios', 'ca-app-pub-7784498406462291/1171261844', true)
ON CONFLICT (screen_name, ad_type, platform) DO NOTHING;

-- Screen-specific ad configurations - Android
INSERT INTO ad_configurations (screen_name, ad_type, platform, ad_unit_id, is_active) VALUES
('home', 'native', 'android', 'ca-app-pub-7784498406462291/1171261844', true),
('home', 'banner', 'android', 'ca-app-pub-7784498406462291/1171261844', true),
('detail', 'native', 'android', 'ca-app-pub-7784498406462291/1171261844', true),
('onboarding', 'banner', 'android', 'ca-app-pub-7784498406462291/1171261844', true),
('onboarding', 'native', 'android', 'ca-app-pub-7784498406462291/1171261844', true)
ON CONFLICT (screen_name, ad_type, platform) DO NOTHING;

-- Screen-specific ad configurations - iOS
INSERT INTO ad_configurations (screen_name, ad_type, platform, ad_unit_id, is_active) VALUES
('home', 'native', 'ios', 'ca-app-pub-7784498406462291/1171261844', true),
('home', 'banner', 'ios', 'ca-app-pub-7784498406462291/1171261844', true),
('detail', 'native', 'ios', 'ca-app-pub-7784498406462291/1171261844', true),
('onboarding', 'banner', 'ios', 'ca-app-pub-7784498406462291/1171261844', true),
('onboarding', 'native', 'ios', 'ca-app-pub-7784498406462291/1171261844', true)
ON CONFLICT (screen_name, ad_type, platform) DO NOTHING;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_ad_configurations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ad_configurations_updated_at
BEFORE UPDATE ON ad_configurations
FOR EACH ROW
EXECUTE FUNCTION update_ad_configurations_updated_at();

-- ============================================
-- Row Level Security (RLS) for ad_configurations table
-- ============================================

-- Enable RLS on ad_configurations table
ALTER TABLE ad_configurations ENABLE ROW LEVEL SECURITY;

-- Policy: Public can view all ad configurations
CREATE POLICY "Public can view ad_configurations"
  ON ad_configurations FOR SELECT
  TO public
  USING (true);

-- Policy: Only admins can insert ad configurations
CREATE POLICY "Admins can insert ad_configurations"
  ON ad_configurations FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- Policy: Only admins can update ad configurations
CREATE POLICY "Admins can update ad_configurations"
  ON ad_configurations FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Policy: Only admins can delete ad configurations
CREATE POLICY "Admins can delete ad_configurations"
  ON ad_configurations FOR DELETE
  TO authenticated
  USING (is_admin());

