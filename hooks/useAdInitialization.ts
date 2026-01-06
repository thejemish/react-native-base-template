import { useEffect, useState, useMemo } from 'react';
import { getBannerAdUnitId } from '@/services/adInitializationService';
import { areAdsEnabled } from '@/services/adConfigService';
import { useNativeAdsPoolStore } from '@/store/ads/nativeAdsPoolStore';

/**
 * Hook to get banner ad unit ID for a screen
 */
export function useBannerAdUnitId(screenName: string, adType: string = 'banner') {
  const [adUnitId, setAdUnitId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    getBannerAdUnitId(screenName, adType)
      .then((id) => {
        setAdUnitId(id);
      })
      .catch((error) => {
        console.error(`[useBannerAdUnitId:${screenName}] Failed:`, error);
        setAdUnitId(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [screenName, adType]);

  return { adUnitId, isLoading };
}

/**
 * Hook to initialize the native ad system
 * Automatically initializes the ad system if not already initialized
 * Use this at the app level or in screens that need the ad system
 * 
 * @param enabled - Whether to enable initialization (default: true)
 * 
 * @example
 * ```tsx
 * // In your main screen or app entry point
 * useInitializeAdSystem();
 * 
 * // Conditionally initialize
 * useInitializeAdSystem(shouldInitialize);
 * ```
 */
export function useInitializeAdSystem(enabled: boolean = true) {
  const initAdSystem = useNativeAdsPoolStore((state) => state.initAdSystem);
  const isInitialized = useNativeAdsPoolStore((state) => state.isInitialized);

  useEffect(() => {
    if (!enabled || isInitialized) {
      return;
    }

    initAdSystem().catch((error: unknown) => {
      console.error('[useInitializeAdSystem] Error initializing ad system:', error);
    });
  }, [enabled, isInitialized, initAdSystem]);
}

/**
 * Hook to preload native ads for fixed positions in a specific screen
 * Perfect for detail screens or screens with fixed ad positions
 * 
 * Uses handleViewportChange to preload ads for specific positions
 * 
 * @param screenName - The screen name to preload ads for
 * @param positions - Array of fixed positions to preload (e.g., [0, 1] for 2 fixed ads)
 * @param enabled - Whether to enable preloading (default: true)
 * 
 * @example
 * ```tsx
 * // Preload 2 fixed ads at positions 0 and 1 for detail screen
 * usePreloadFixedNativeAds('detail', [0, 1]);
 * 
 * // Preload 3 fixed ads at positions 0, 1, 2
 * usePreloadFixedNativeAds('detail', [0, 1, 2]);
 * ```
 */
export function usePreloadFixedNativeAds(
  screenName: string,
  positions: number[],
  enabled: boolean = true
) {
  const initAdSystem = useNativeAdsPoolStore((state) => state.initAdSystem);
  const handleViewportChange = useNativeAdsPoolStore((state) => state.handleViewportChange);
  const isInitialized = useNativeAdsPoolStore((state) => state.isInitialized);

  // Create stable key from positions array for dependency tracking
  const positionsKey = useMemo(() => positions.join(','), [positions]);

  useEffect(() => {
    if (!enabled || positions.length === 0) {
      return;
    }

    const preloadAds = async () => {
      // Check if ads are enabled for this screen
      const adsEnabled = await areAdsEnabled(screenName);
      if (!adsEnabled) {
        console.log(`[usePreloadFixedNativeAds] Ads are disabled for ${screenName}, skipping preload`);
        return;
      }

      // Initialize the ad system if not already initialized
      if (!isInitialized) {
        await initAdSystem();
      }

      // Wait a bit for initialization to complete
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Use handleViewportChange to preload ads for the specified positions
      // Treat the positions as a viewport range
      const minPos = Math.min(...positions);
      const maxPos = Math.max(...positions);
      const totalItems = maxPos + 5; // Add buffer for preload distance

      try {
        await handleViewportChange(screenName, minPos, maxPos, totalItems);
      } catch (error) {
        console.error(`[usePreloadFixedNativeAds] Error preloading ads for ${screenName}:`, error);
      }
    };

    preloadAds();
  }, [enabled, screenName, positionsKey, isInitialized, initAdSystem, handleViewportChange, positions]);
}

/**
 * Hook to preload native ads for a specific screen
 * Preloads ads for initial viewport to avoid loading state
 * Call this from onboarding or any screen to preload ads for another screen
 * 
 * @param screenName - The screen name to preload ads for
 * @param enabled - Whether to enable preloading (default: true)
 * 
 * @example
 * ```tsx
 * // In onboarding screen, preload ads for home screen
 * usePreloadNativeAdsForScreen('home');
 * ```
 */
export function usePreloadNativeAdsForScreen(screenName: string, enabled: boolean = true) {
  const initAdSystem = useNativeAdsPoolStore((state) => state.initAdSystem);
  const handleViewportChange = useNativeAdsPoolStore((state) => state.handleViewportChange);
  const refillPool = useNativeAdsPoolStore((state) => state.refillPool);
  const isInitialized = useNativeAdsPoolStore((state) => state.isInitialized);
  const config = useNativeAdsPoolStore((state) => state.configs[screenName]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const preloadAds = async () => {
      // Check if ads are enabled for this screen
      const adsEnabled = await areAdsEnabled(screenName);
      if (!adsEnabled) {
        console.log(`[usePreloadNativeAdsForScreen] Ads are disabled for ${screenName}, skipping preload`);
        return;
      }

      // Initialize the ad system if not already initialized
      if (!isInitialized) {
        await initAdSystem();
      }

      // Wait a bit for initialization to complete
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Preload ads for initial viewport (positions 0-2)
      // This simulates the viewport being at the start of the list
      if (config) {
        try {
          await handleViewportChange(screenName, 0, 2, 10);
        } catch (error) {
          console.error(`[usePreloadNativeAdsForScreen] Error preloading ads for ${screenName}:`, error);
        }
      } else {
        // If no config, just fill the pool
        await refillPool(screenName);
      }
    };

    preloadAds();
  }, [enabled, screenName, isInitialized, initAdSystem, handleViewportChange, refillPool, config]);
}
