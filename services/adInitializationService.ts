import { getAdUnitId, areAdsEnabled } from './adConfigService';
/**
 * Initialize banner ad for a screen
 * @param screenName - The screen name
 * @param adType - The ad type (default: 'banner')
 * @returns Promise that resolves to ad unit ID if enabled, null otherwise
 */
export async function getBannerAdUnitId(
  screenName: string,
  adType: string = 'banner'
): Promise<string | null> {
  try {
    const enabled = await areAdsEnabled(screenName);
    if (!enabled) {
      return null;
    }
    return await getAdUnitId(screenName, adType);
  } catch (error) {
    console.error(`[AdInit:${screenName}] Failed to get banner ad unit ID:`, error);
    return null;
  }
}
