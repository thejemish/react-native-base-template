-- Create ad_preload_settings table
-- This table stores preloading settings for different screens and ad types
CREATE TABLE IF NOT EXISTS ad_preload_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  screen_name VARCHAR(100) NOT NULL,
  ad_type VARCHAR(50) NOT NULL,
  pool_size INTEGER DEFAULT 4,
  min_pool_size INTEGER DEFAULT 3,
  ad_frequency INTEGER DEFAULT 2,
  preload_distance INTEGER DEFAULT 2,
  dispose_distance INTEGER DEFAULT 4,
  counter_threshold INTEGER DEFAULT 2, -- For interstitial ads
  max_position_ads INTEGER DEFAULT 15, -- Maximum number of position-assigned ads per screen (for native ads)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(screen_name, ad_type)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_ad_preload_settings_screen_type ON ad_preload_settings(screen_name, ad_type);
CREATE INDEX IF NOT EXISTS idx_ad_preload_settings_active ON ad_preload_settings(is_active);

-- Insert default preload settings for native ads
INSERT INTO ad_preload_settings (screen_name, ad_type, pool_size, min_pool_size, ad_frequency, preload_distance, dispose_distance, max_position_ads, is_active) VALUES
('home', 'native', 4, 4, 2, 2, 4, 15, true),
('detail', 'native', 3, 3, 1, 1, 10, 15, true),
('onboarding', 'native', 4, 4, 2, 2, 4, 15, true)
ON CONFLICT (screen_name, ad_type) DO NOTHING;

-- Insert default preload settings for interstitial ads
INSERT INTO ad_preload_settings (screen_name, ad_type, counter_threshold, is_active) VALUES
('global', 'interstitial', 2, true)
ON CONFLICT (screen_name, ad_type) DO NOTHING;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_ad_preload_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ad_preload_settings_updated_at
BEFORE UPDATE ON ad_preload_settings
FOR EACH ROW
EXECUTE FUNCTION update_ad_preload_settings_updated_at();

-- ============================================
-- Row Level Security (RLS) for ad_preload_settings table
-- ============================================

-- Enable RLS on ad_preload_settings table
ALTER TABLE ad_preload_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Public can view all ad preload settings
CREATE POLICY "Public can view ad_preload_settings"
  ON ad_preload_settings FOR SELECT
  TO public
  USING (true);

-- Policy: Only admins can insert ad preload settings
CREATE POLICY "Admins can insert ad_preload_settings"
  ON ad_preload_settings FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- Policy: Only admins can update ad preload settings
CREATE POLICY "Admins can update ad_preload_settings"
  ON ad_preload_settings FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Policy: Only admins can delete ad preload settings
CREATE POLICY "Admins can delete ad_preload_settings"
  ON ad_preload_settings FOR DELETE
  TO authenticated
  USING (is_admin());