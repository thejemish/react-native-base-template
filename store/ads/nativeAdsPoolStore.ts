import { create } from 'zustand';
import { Platform } from 'react-native';
import {
  NativeAd,
  TestIds,
} from 'react-native-google-mobile-ads';
import { supabase } from '@/utils/supabase';
import { getAdUnitId, areAdsEnabled, type AdConfiguration, type AdPreloadSettings } from '@/services/adConfigService';

export interface AdItem {
  id: string;
  nativeAd: NativeAd;
  loadedAt: number; // Date.now()
  retryCount: number;
  adUnitId: string;
}

interface AdPoolState {
  pools: Record<string, AdItem[]>; // General pool of available ads
  positionAds: Record<string, Record<number, AdItem>>; // Maps screenName -> position -> AdItem
  configs: Record<string, AdPreloadSettings | null>; // From Supabase ad_preload_settings
  configCache: Record<string, AdConfiguration | null>; // From Supabase ad_configurations
  expiryMonitorInterval: ReturnType<typeof setInterval> | null;
  isInitialized: boolean;
  refillingQueues: Record<string, boolean>; // Track refilling state
  loadingPositions: Record<string, number[]>; // Track positions currently loading (use array for proper reactivity)
  lastViewport: Record<string, { start: number; end: number }>; // Track last viewport per screen

  // Actions
  initAdSystem: () => Promise<void>;
  refillPool: (screenName: string) => Promise<void>;
  startExpiryMonitor: () => void;
  
  // Position-based ad management
  getAdForPosition: (screenName: string, position: number) => AdItem | null;
  isPositionLoading: (screenName: string, position: number) => boolean;
  handleViewportChange: (screenName: string, visibleStart: number, visibleEnd: number, totalItems: number) => Promise<void>;
}

// Generate unique ID for ad items
const generateAdId = (): string => `ad-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Helper to determine if we're in dev mode
const isDev = __DEV__ || process.env.NODE_ENV === 'development';

// Helper to get ad unit ID (TestIds for dev, Supabase for prod)
const getAdUnitIdForScreen = async (screenName: string): Promise<string | null> => {
  if (isDev) {
    return TestIds.NATIVE;
  }
  return await getAdUnitId(screenName, 'native');
};

export const useNativeAdsPoolStore = create<AdPoolState>((set, get) => ({
  pools: {},
  positionAds: {},
  configs: {},
  configCache: {},
  expiryMonitorInterval: null,
  isInitialized: false,
  refillingQueues: {},
  loadingPositions: {},
  lastViewport: {},

  /**
   * Initialize the ad system by fetching all active configs from Supabase
   */
  initAdSystem: async () => {
    if (get().isInitialized) {
      return;
    }

    try {
      const currentPlatform = Platform.OS;

      // Fetch all active ad configurations for native ads
      const { data: adConfigs, error: configError } = await supabase
        .from('ad_configurations')
        .select('*')
        .eq('is_active', true)
        .eq('platform', currentPlatform)
        .eq('ad_type', 'native');

      if (configError) {
        throw configError;
      }

      // Build config cache keyed by screen_name
      const configCache: Record<string, AdConfiguration | null> = {};
      if (adConfigs) {
        for (const config of adConfigs) {
          configCache[config.screen_name] = config;
        }
      }

      // Fetch all active preload settings for native ads
      const { data: preloadSettings, error: settingsError } = await supabase
        .from('ad_preload_settings')
        .select('*')
        .eq('is_active', true)
        .eq('ad_type', 'native');

      if (settingsError) {
        throw settingsError;
      }

      // Build configs cache keyed by screen_name
      const configs: Record<string, AdPreloadSettings | null> = {};
      if (preloadSettings) {
        for (const setting of preloadSettings) {
          configs[setting.screen_name] = setting;
        }
      }

      set({
        configCache,
        configs,
        isInitialized: true,
      });

      // Start expiry monitor
      get().startExpiryMonitor();

      // Pre-fill pools for all configured screens
      for (const screenName in configs) {
        get().refillPool(screenName).catch(console.error);
      }
    } catch (error) {
      console.error('[NativeAdsPoolStore] Failed to initialize ad system:', error);
      set({ isInitialized: false });
    }
  },

  /**
   * Refill pool for a specific screen to maintain min_pool_size
   * Loads ads sequentially to avoid overwhelming the ad network
   */
  refillPool: async (screenName: string) => {
    const state = get();
    
    // Prevent concurrent refills
    if (state.refillingQueues[screenName]) {
      return;
    }

    // Check if ads are enabled
    const adsEnabled = await areAdsEnabled(screenName);
    if (!adsEnabled) {
      return;
    }

    const config = state.configs[screenName];
    if (!config) {
      return;
    }

    const poolSize = config.pool_size || 5;
    const minPoolSize = config.min_pool_size || 3;
    const currentPool = state.pools[screenName] || [];

    // Only refill if below min_pool_size
    if (currentPool.length >= minPoolSize) {
      return;
    }

    // Mark as refilling
    set((s) => ({
      refillingQueues: { ...s.refillingQueues, [screenName]: true },
    }));

    try {
      const adUnitId = await getAdUnitIdForScreen(screenName);
      if (!adUnitId) {
        return;
      }

      // Calculate how many ads to load (up to pool_size)
      const needed = poolSize - currentPool.length;

      for (let i = 0; i < needed; i++) {
        // Re-check pool size to avoid exceeding limit
        const freshPool = get().pools[screenName] || [];
        if (freshPool.length >= poolSize) {
          break;
        }

        let retryCount = 0;
        let loaded = false;

        while (!loaded && retryCount < 3) {
          try {
            const nativeAd = await NativeAd.createForAdRequest(adUnitId);
            
            const newAdItem: AdItem = {
              id: generateAdId(),
              nativeAd,
              loadedAt: Date.now(),
              retryCount: 0,
              adUnitId,
            };

            // Add to pool
            set((s) => ({
              pools: {
                ...s.pools,
                [screenName]: [...(s.pools[screenName] || []), newAdItem],
              },
            }));

            loaded = true;
          } catch {
            retryCount++;
            if (retryCount < 3) {
              await new Promise((resolve) => setTimeout(resolve, 1000 * retryCount));
            }
          }
        }
      }
    } finally {
      set((s) => ({
        refillingQueues: { ...s.refillingQueues, [screenName]: false },
      }));
    }
  },

  /**
   * Start expiry monitor that runs every 5 minutes
   * Destroys ads older than 60 minutes
   */
  startExpiryMonitor: () => {
    const state = get();
    if (state.expiryMonitorInterval) {
      return;
    }

    const interval = setInterval(() => {
      const currentState = get();
      const now = Date.now();
      const expiryTime = 60 * 60 * 1000; // 60 minutes

      // Check pools
      const updatedPools: Record<string, AdItem[]> = {};
      for (const screenName in currentState.pools) {
        const pool = currentState.pools[screenName];
        const validAds: AdItem[] = [];
        
        for (const adItem of pool) {
          if (now - adItem.loadedAt > expiryTime) {
            try { adItem.nativeAd.destroy(); } catch {}
          } else {
            validAds.push(adItem);
          }
        }
        updatedPools[screenName] = validAds;
      }

      // Check positionAds
      const updatedPositionAds: Record<string, Record<number, AdItem>> = {};
      for (const screenName in currentState.positionAds) {
        const positionMap = currentState.positionAds[screenName];
        const validPositionAds: Record<number, AdItem> = {};
        
        for (const pos in positionMap) {
          const adItem = positionMap[pos];
          if (now - adItem.loadedAt > expiryTime) {
            try { adItem.nativeAd.destroy(); } catch {}
          } else {
            validPositionAds[Number(pos)] = adItem;
          }
        }
        updatedPositionAds[screenName] = validPositionAds;
      }

      set({ pools: updatedPools, positionAds: updatedPositionAds });

      // Refill pools as needed
      for (const screenName in currentState.configs) {
        get().refillPool(screenName).catch(console.error);
      }
    }, 5 * 60 * 1000);

    set({ expiryMonitorInterval: interval });
  },

  /**
   * Get ad for a specific position (synchronous)
   */
  getAdForPosition: (screenName: string, position: number) => {
    const state = get();
    return state.positionAds[screenName]?.[position] || null;
  },

  /**
   * Check if a position is currently loading
   */
  isPositionLoading: (screenName: string, position: number) => {
    const state = get();
    const loading = state.loadingPositions[screenName] || [];
    return loading.includes(position);
  },

  /**
   * Handle viewport changes - main method for viewport-based ad management
   * 
   * With your settings (dispose_distance: 10, max_position_ads: 15):
   * - Keeps ads within 10 positions of viewport
   * - Max 15 position ads at any time
   * - Preloads ads ahead of scroll direction
   */
  handleViewportChange: async (screenName: string, visibleStart: number, visibleEnd: number, totalItems: number) => {
    // Get fresh state at the start
    const state = get();
    const config = state.configs[screenName];
    
    if (!config) {
      return;
    }

    // Check if ads are enabled
    const adsEnabled = await areAdsEnabled(screenName);
    if (!adsEnabled) {
      return;
    }

    // Validate inputs
    if (visibleStart < 0 || visibleEnd < 0 || totalItems <= 0) {
      return;
    }

    // Get config values
    const adFrequency = config.ad_frequency || 1;
    const disposeDistance = config.dispose_distance || 10;
    const preloadDistance = config.preload_distance || 3;
    const maxPositionAds = config.max_position_ads || 15;

    // Helper: Check if position should have an ad based on ad_frequency
    const shouldHaveAd = (position: number): boolean => {
      if (adFrequency === 1) {
        return true; // Every position has an ad
      }
      return (position + 1) % adFrequency === 0;
    };

    // Get FRESH state to avoid race conditions
    const freshState = get();
    const currentPositionAds = { ...(freshState.positionAds[screenName] || {}) };
    const currentLoading = [...(freshState.loadingPositions[screenName] || [])];

    // Calculate keep zone (viewport ± dispose_distance)
    const keepStart = Math.max(0, visibleStart - disposeDistance);
    const keepEnd = Math.min(totalItems - 1, visibleEnd + disposeDistance);

    // 1. DISPOSE: Remove ads outside the keep zone
    const positionsToDispose: number[] = [];
    for (const posStr in currentPositionAds) {
      const pos = Number(posStr);
      // Don't dispose if within keep zone or currently loading
      if (pos < keepStart || pos > keepEnd) {
        if (!currentLoading.includes(pos)) {
          positionsToDispose.push(pos);
        }
      }
    }

    // Dispose ads
    for (const pos of positionsToDispose) {
      const adItem = currentPositionAds[pos];
      if (adItem) {
        try { adItem.nativeAd.destroy(); } catch {}
        delete currentPositionAds[pos];
      }
    }

    // 2. PRELOAD: Load ads for positions in preload zone
    // Preload zone: visibleStart to (visibleEnd + preloadDistance)
    const preloadEnd = Math.min(totalItems - 1, visibleEnd + preloadDistance);
    const positionsToPreload: number[] = [];

    for (let i = visibleStart; i <= preloadEnd; i++) {
      if (shouldHaveAd(i)) {
        // Check if ad doesn't exist and isn't already loading (use fresh state)
        if (!currentPositionAds[i] && !currentLoading.includes(i)) {
          positionsToPreload.push(i);
        }
      }
    }

    // Also preload a few positions before viewport (for scroll up)
    const preloadStart = Math.max(0, visibleStart - preloadDistance);
    for (let i = preloadStart; i < visibleStart; i++) {
      if (shouldHaveAd(i)) {
        if (!currentPositionAds[i] && !currentLoading.includes(i)) {
          positionsToPreload.push(i);
        }
      }
    }

    // Check max_position_ads limit
    const currentCount = Object.keys(currentPositionAds).length;
    const remainingSlots = Math.max(0, maxPositionAds - currentCount);
    const limitedPositionsToPreload = positionsToPreload.slice(0, remainingSlots);

    // ATOMICALLY mark positions as loading to prevent race conditions
    // Filter out positions that are already being loaded by another call
    const actualPositionsToPreload = limitedPositionsToPreload.filter((pos) => {
      const latestLoading = get().loadingPositions[screenName] || [];
      const latestAds = get().positionAds[screenName] || {};
      return !latestLoading.includes(pos) && !latestAds[pos];
    });

    if (actualPositionsToPreload.length === 0 && positionsToDispose.length === 0) {
      // Nothing to do
      return;
    }

    // Update state with disposed ads and loading state
    set((s) => ({
      positionAds: { ...s.positionAds, [screenName]: currentPositionAds },
      loadingPositions: { 
        ...s.loadingPositions, 
        [screenName]: [...(s.loadingPositions[screenName] || []), ...actualPositionsToPreload]
      },
      lastViewport: { ...s.lastViewport, [screenName]: { start: visibleStart, end: visibleEnd } },
    }));

    // 3. LOAD ADS: Load ads for preload positions
    if (actualPositionsToPreload.length > 0) {
      const adUnitId = await getAdUnitIdForScreen(screenName);
      if (!adUnitId) {
        // Clear loading state
        set((s) => ({
          loadingPositions: {
            ...s.loadingPositions,
            [screenName]: (s.loadingPositions[screenName] || []).filter(
              (p) => !actualPositionsToPreload.includes(p)
            ),
          },
        }));
        return;
      }

      // Load ads for each position
      for (const position of actualPositionsToPreload) {
        // Re-check if position still needs an ad (might have been loaded by another call)
        const freshState = get();
        if (freshState.positionAds[screenName]?.[position]) {
          // Already has an ad, remove from loading
          set((s) => ({
            loadingPositions: {
              ...s.loadingPositions,
              [screenName]: (s.loadingPositions[screenName] || []).filter((p) => p !== position),
            },
          }));
          continue;
        }

        let adItem: AdItem | null = null;

        // Try to get from pool first
        const pool = get().pools[screenName] || [];
        if (pool.length > 0) {
          // Take oldest ad from pool
          const sortedPool = [...pool].sort((a, b) => a.loadedAt - b.loadedAt);
          adItem = sortedPool[0];
          
          // Remove from pool
          set((s) => ({
            pools: {
              ...s.pools,
              [screenName]: (s.pools[screenName] || []).filter((ad) => ad.id !== adItem!.id),
            },
          }));
        }

        // If no ad in pool, load a new one
        if (!adItem) {
          let retryCount = 0;
          while (!adItem && retryCount < 2) {
            try {
              const nativeAd = await NativeAd.createForAdRequest(adUnitId);
              adItem = {
                id: generateAdId(),
                nativeAd,
                loadedAt: Date.now(),
                retryCount: 0,
                adUnitId,
              };
            } catch {
              retryCount++;
              if (retryCount < 2) {
                await new Promise((resolve) => setTimeout(resolve, 500));
              }
            }
          }
        }

        // Assign ad to position and remove from loading
        set((s) => {
          const updatedPositionAds = { ...s.positionAds[screenName] };
          if (adItem) {
            updatedPositionAds[position] = adItem;
          }
          
          return {
            positionAds: { ...s.positionAds, [screenName]: updatedPositionAds },
            loadingPositions: {
              ...s.loadingPositions,
              [screenName]: (s.loadingPositions[screenName] || []).filter((p) => p !== position),
            },
          };
        });
      }

      // Refill pool in background
      get().refillPool(screenName).catch(console.error);
    }

    // 4. ENFORCE max_position_ads limit
    const finalState = get();
    const finalPositionAds = { ...(finalState.positionAds[screenName] || {}) };
    const finalCount = Object.keys(finalPositionAds).length;

    if (finalCount > maxPositionAds) {
      // Remove positions furthest from current viewport
      const sortedPositions = Object.keys(finalPositionAds)
        .map(Number)
        .sort((a, b) => {
          // Sort by distance from viewport center
          const center = (visibleStart + visibleEnd) / 2;
          return Math.abs(b - center) - Math.abs(a - center);
        });

      // Remove excess (furthest first)
      const toRemove = sortedPositions.slice(0, finalCount - maxPositionAds);
      for (const pos of toRemove) {
        const adItem = finalPositionAds[pos];
        if (adItem) {
          try { adItem.nativeAd.destroy(); } catch {}
          delete finalPositionAds[pos];
        }
      }

      set((s) => ({
        positionAds: { ...s.positionAds, [screenName]: finalPositionAds },
      }));
    }
  },
}));






