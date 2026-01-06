import { Platform } from 'react-native';
import { supabase } from '@/utils/supabase';

export interface AdConfiguration {
  id: string;
  screen_name: string;
  ad_type: string;
  platform: string;
  ad_unit_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdPreloadSettings {
  id: string;
  screen_name: string;
  ad_type: string;
  pool_size: number;
  min_pool_size: number;
  ad_frequency: number;
  preload_distance: number;
  dispose_distance: number;
  counter_threshold: number;
  max_position_ads?: number; // Maximum number of position-assigned ads per screen (for native ads)
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Get the current platform name
 * Returns 'android', 'ios', or 'web'
 */
function getPlatform(): string {
  return Platform.OS;
}

/**
 * Check if ads are enabled for a specific screen or globally
 * @param screenName - Optional screen name to check. If not provided, checks globally.
 * @param platform - Optional platform to check. If not provided, uses current platform.
 * Returns true if there are any active ad configurations for the screen (or globally), false otherwise
 */
export async function areAdsEnabled(screenName?: string, platform?: string): Promise<boolean> {
  try {
    const currentPlatform = platform || getPlatform();
    let query = supabase
      .from('ad_configurations')
      .select('id')
      .eq('is_active', true)
      .eq('platform', currentPlatform);

    // Filter by screen_name if provided
    if (screenName) {
      query = query.eq('screen_name', screenName);
    }

    const { data, error } = await query.limit(1);

    if (error) {
      console.error('[AdConfigService] Error checking if ads are enabled:', error);
      // Default to enabled if there's an error (fail open)
      return true;
    }

    // Ads are enabled if there's at least one active configuration
    return (data && data.length > 0) || false;
  } catch (error) {
    console.error('[AdConfigService] Error checking if ads are enabled:', error);
    // Default to enabled if there's an error (fail open)
    return true;
  }
}

/**
 * Get ad unit ID for a specific screen and ad type
 * @param screenName - Screen name
 * @param adType - Ad type
 * @param platform - Optional platform. If not provided, uses current platform.
 * Returns null if ads are globally disabled or configuration not found
 */
export async function getAdUnitId(
  screenName: string,
  adType: string,
  platform?: string
): Promise<string | null> {
  try {
    const currentPlatform = platform || getPlatform();
    
    // First check if ads are enabled for this screen
    const adsEnabled = await areAdsEnabled(screenName, currentPlatform);
    if (!adsEnabled) {
      console.log(`[AdConfigService] Ads are disabled for screen ${screenName} on platform ${currentPlatform}, returning null`);
      return null;
    }

    const { data, error } = await supabase
      .from('ad_configurations')
      .select('ad_unit_id')
      .eq('screen_name', screenName)
      .eq('ad_type', adType)
      .eq('platform', currentPlatform)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      console.warn(
        `[AdConfigService] No configuration found for ${screenName}/${adType} on platform ${currentPlatform}`
      );
      return null;
    }

    return data.ad_unit_id;
  } catch (error) {
    console.error(
      `[AdConfigService] Error fetching ad unit ID for ${screenName}/${adType}:`,
      error
    );
    return null;
  }
}

// Type for native ad preload settings (matches ScreenAdConfig + counter_threshold)
export interface NativeAdPreloadSettings {
  poolSize: number;
  minPoolSize: number;
  adFrequency: number;
  preloadDistance: number;
  disposeDistance: number;
  counterThreshold: number;
}

/**
 * Get preload settings for a specific screen and ad type
 * Returns null if ads are globally disabled
 * Returns all settings including counter_threshold
 */
export async function getPreloadSettings(
  screenName: string,
  adType: string
): Promise<Partial<NativeAdPreloadSettings> | null> {
  try {
    // First check if ads are enabled for this screen
    const adsEnabled = await areAdsEnabled(screenName);
    if (!adsEnabled) {
      console.log(`[AdConfigService] Ads are disabled for screen ${screenName}, returning null for preload settings`);
      return null;
    }

    const { data, error } = await supabase
      .from('ad_preload_settings')
      .select('*')
      .eq('screen_name', screenName)
      .eq('ad_type', adType)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      console.warn(
        `[AdConfigService] No preload settings found for ${screenName}/${adType}`
      );
      return null;
    }

    // Map database fields to return all parameters
    return {
      poolSize: data.pool_size,
      minPoolSize: data.min_pool_size,
      adFrequency: data.ad_frequency,
      preloadDistance: data.preload_distance,
      disposeDistance: data.dispose_distance,
      counterThreshold: data.counter_threshold,
    };
  } catch (error) {
    console.error(
      `[AdConfigService] Error fetching preload settings for ${screenName}/${adType}:`,
      error
    );
    return null;
  }
}

/**
 * Get counter threshold for interstitial ads
 * Returns 2 as default if ads are disabled or settings not found
 */
export async function getInterstitialCounterThreshold(): Promise<number> {
  try {
    // First check if ads are enabled for global screen
    const adsEnabled = await areAdsEnabled('global');
    if (!adsEnabled) {
      console.log('[AdConfigService] Ads are disabled for global screen, returning default counter threshold');
      return 2;
    }

    const settings = await getPreloadSettings('global', 'interstitial');
    return settings?.counterThreshold ?? 2;
  } catch (error) {
    console.error('[AdConfigService] Error fetching interstitial counter threshold:', error);
    return 2;
  }
}

/**
 * Get all ad configurations (useful for admin/debugging)
 * @param platform - Optional platform filter. If not provided, returns all platforms.
 */
export async function getAllAdConfigurations(platform?: string): Promise<AdConfiguration[]> {
  try {
    let query = supabase
      .from('ad_configurations')
      .select('*')
      .eq('is_active', true);

    if (platform) {
      query = query.eq('platform', platform);
    }

    const { data, error } = await query
      .order('platform', { ascending: true })
      .order('screen_name', { ascending: true })
      .order('ad_type', { ascending: true });

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('[AdConfigService] Error fetching all ad configurations:', error);
    return [];
  }
}

/**
 * Get all preload settings (useful for admin/debugging)
 */
export async function getAllPreloadSettings(): Promise<AdPreloadSettings[]> {
  try {
    const { data, error } = await supabase
      .from('ad_preload_settings')
      .select('*')
      .eq('is_active', true)
      .order('screen_name', { ascending: true })
      .order('ad_type', { ascending: true });

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('[AdConfigService] Error fetching all preload settings:', error);
    return [];
  }
}
