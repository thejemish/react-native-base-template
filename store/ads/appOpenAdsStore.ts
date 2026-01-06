import { create } from 'zustand';
import {
  AppOpenAd,
  AdEventType,
} from 'react-native-google-mobile-ads';
import { areAdsEnabled } from '@/services/adConfigService';

// Request options type based on documentation
type AppOpenAdRequestOptions = {
  keywords?: string[];
  location?: { latitude: number; longitude: number };
  [key: string]: any; // Allow other optional properties
};

// Type for event listener unsubscribe function returned by addAdEventListener
type AdEventListener = () => void;

interface AppOpenAdState {
  // Ad instance
  appOpenAd: AppOpenAd | null;
  isLoaded: boolean;
  isLoading: boolean;
  isShowing: boolean;

  // Configuration
  adUnitId: string;
  requestOptions: AppOpenAdRequestOptions | undefined;

  // Event listeners
  eventListeners: AdEventListener[];

  // Error handling
  error: Error | null;

  // Ad expiration tracking (ads expire after 4 hours)
  adLoadTime: number | null;

  // Foreground suppression (used when launching camera/image picker, etc.)
  suppressNextForegroundAd: boolean;
  setSuppressNextForegroundAd: (value: boolean) => void;
  consumeForegroundSuppression: () => boolean;

  // Methods
  initialize: (adUnitId?: string, requestOptions?: AppOpenAdRequestOptions) => void;
  preloadAd: () => Promise<void>;
  showAd: () => Promise<void>;
  isAdExpired: () => boolean;
  reset: () => void;
}

// 4 hours in milliseconds (as per Google documentation)
const AD_EXPIRATION_TIME = 4 * 60 * 60 * 1000;

export const useAppOpenAdsStore = create<AppOpenAdState>((set, get) => ({
  appOpenAd: null,
  isLoaded: false,
  isLoading: false,
  isShowing: false,
  adUnitId: '',
  requestOptions: undefined,
  eventListeners: [],
  error: null,
  adLoadTime: null,
  suppressNextForegroundAd: false,
  setSuppressNextForegroundAd: (value: boolean) => set({ suppressNextForegroundAd: value }),
  consumeForegroundSuppression: () => {
    const shouldSuppress = get().suppressNextForegroundAd;
    if (shouldSuppress) {
      set({ suppressNextForegroundAd: false });
    }
    return shouldSuppress;
  },

  /**
   * Check if the current ad has expired (more than 4 hours old)
   */
  isAdExpired: () => {
    const state = get();
    if (!state.adLoadTime) {
      return true;
    }
    const now = Date.now();
    return now - state.adLoadTime > AD_EXPIRATION_TIME;
  },

  /**
   * Initialize the app open ads store
   */
  initialize: (adUnitId, requestOptions) => {
    const currentState = get();
    
    // Don't initialize if adUnitId is empty or invalid
    if (!adUnitId || adUnitId.trim() === '') {
      console.log('[AppOpenAdsStore] No ad unit ID provided, skipping initialization');
      return;
    }
    
    // Don't reinitialize if already initialized with the same config
    if (
      currentState.appOpenAd &&
      currentState.adUnitId === adUnitId
    ) {
      return;
    }

    // Clean up existing ad if any
    if (currentState.appOpenAd) {
      // Unsubscribe from all event listeners
      currentState.eventListeners.forEach((unsubscribe) => {
        try {
          unsubscribe();
        } catch (error) {
          console.warn('[AppOpenAdsStore] Error unsubscribing listener:', error);
        }
      });
    }

    set({
      adUnitId: adUnitId || '',
      requestOptions,
      appOpenAd: null,
      isLoaded: false,
      isLoading: false,
      isShowing: false,
      eventListeners: [],
      error: null,
      adLoadTime: null,
    });

    // Preload the first ad only if adUnitId is valid
    if (adUnitId && adUnitId.trim() !== '') {
      get().preloadAd().catch((error) => {
        console.error('[AppOpenAdsStore] Failed to preload initial ad:', error);
      });
    }
  },

  /**
   * Preload an app open ad
   * This ensures we always have 1 ad ready
   */
  preloadAd: async () => {
    const currentState = get();

    // Check if adUnitId is valid before preloading
    if (!currentState.adUnitId || currentState.adUnitId.trim() === '') {
      console.log('[AppOpenAdsStore] No ad unit ID available, skipping ad preload');
      return;
    }

    // Check if ads are enabled before preloading
    const adsEnabled = await areAdsEnabled('global');
    if (!adsEnabled) {
      console.log('[AppOpenAdsStore] Ads are disabled for global screen, skipping ad preload');
      return;
    }

    // Don't preload if already loading
    if (currentState.isLoading) {
      return;
    }

    // Don't preload if already loaded and not expired
    if (currentState.isLoaded && !get().isAdExpired()) {
      return;
    }

    // Don't preload if currently showing
    if (currentState.isShowing) {
      return;
    }

    set({ isLoading: true, error: null });

    try {
      // Clean up existing ad if any
      if (currentState.appOpenAd) {
        // Unsubscribe from all event listeners
        currentState.eventListeners.forEach((unsubscribe) => {
          try {
            unsubscribe();
          } catch (error) {
            console.warn('[AppOpenAdsStore] Error unsubscribing listener:', error);
          }
        });
      }

      // Create new app open ad
      const appOpenAd = AppOpenAd.createForAdRequest(
        currentState.adUnitId,
        currentState.requestOptions
      );

      // Set up event listeners
      const eventListeners: AdEventListener[] = [];

      // Ad loaded event
      const unsubscribeLoaded = appOpenAd.addAdEventListener(AdEventType.LOADED, () => {
        console.log('[AppOpenAdsStore] App open ad loaded successfully');
        set({ 
          isLoaded: true, 
          isLoading: false, 
          error: null,
          adLoadTime: Date.now(),
        });
      });

      // Ad error event
      const unsubscribeError = appOpenAd.addAdEventListener(AdEventType.ERROR, (errorEvent) => {
        console.error('[AppOpenAdsStore] App open ad error:', errorEvent);
        // Error event structure may vary, handle both Error objects and event objects
        const err =
          errorEvent instanceof Error
            ? errorEvent
            : (errorEvent as any)?.error instanceof Error
              ? (errorEvent as any).error
              : new Error(String((errorEvent as any)?.error || errorEvent || 'Unknown error'));
        set({ isLoading: false, isLoaded: false, error: err });
      });

      // Ad opened event
      const unsubscribeOpened = appOpenAd.addAdEventListener(AdEventType.OPENED, () => {
        console.log('[AppOpenAdsStore] App open ad opened');
        set({ isShowing: true });
      });

      // Ad closed event - preload next ad immediately
      const unsubscribeClosed = appOpenAd.addAdEventListener(AdEventType.CLOSED, () => {
        console.log('[AppOpenAdsStore] App open ad closed - preloading next ad');
        
        // Clean up the current ad instance
        const stateAfterClose = get();
        if (stateAfterClose.appOpenAd) {
          // Unsubscribe from all event listeners
          stateAfterClose.eventListeners.forEach((unsubscribe) => {
            try {
              unsubscribe();
            } catch (error) {
              console.warn('[AppOpenAdsStore] Error unsubscribing listener on close:', error);
            }
          });
        }
        
        // Reset state completely before preloading next ad
        set({ 
          isShowing: false, 
          isLoaded: false,
          isLoading: false, // Ensure loading state is reset
          appOpenAd: null, 
          eventListeners: [],
          adLoadTime: null,
          error: null, // Clear any previous errors
        });
        
        // Immediately preload next ad after a brief delay to ensure state is reset
        // Using setTimeout with 0ms to ensure state update is processed first
        // Check if ads are enabled before preloading
        setTimeout(async () => {
          const adsEnabled = await areAdsEnabled('global');
          if (adsEnabled) {
            get().preloadAd().catch((error) => {
              console.error('[AppOpenAdsStore] Failed to preload next ad after close:', error);
            });
          }
        }, 0);
      });

      eventListeners.push(unsubscribeLoaded, unsubscribeError, unsubscribeOpened, unsubscribeClosed);

      set({
        appOpenAd,
        eventListeners,
      });

      // Load the ad
      await appOpenAd.load();
    } catch (error) {
      console.error('[AppOpenAdsStore] Failed to create/load ad:', error);
      const err = error instanceof Error ? error : new Error(String(error));
      set({
        isLoading: false,
        isLoaded: false,
        error: err,
        appOpenAd: null,
        eventListeners: [],
        adLoadTime: null,
      });
    }
  },

  /**
   * Show the preloaded app open ad
   */
  showAd: async () => {
    const currentState = get();

    // Check if ads are enabled before showing
    const adsEnabled = await areAdsEnabled('global');
    if (!adsEnabled) {
      console.log('[AppOpenAdsStore] Ads are disabled for global screen, skipping ad show');
      throw new Error('Ads are disabled');
    }

    if (!currentState.appOpenAd) {
      throw new Error('No app open ad available');
    }

    // Check if ad has expired
    if (get().isAdExpired()) {
      console.warn('[AppOpenAdsStore] Ad has expired, preloading new ad');
      // Preload a new ad (only if ads are enabled)
      if (adsEnabled) {
        await get().preloadAd();
      }
      throw new Error('App open ad has expired. Please try again after the ad loads.');
    }

    if (!currentState.isLoaded) {
      throw new Error('App open ad is not loaded yet');
    }

    if (currentState.isShowing) {
      throw new Error('App open ad is already showing');
    }

    try {
      await currentState.appOpenAd.show();
    } catch (error) {
      console.error('[AppOpenAdsStore] Failed to show ad:', error);
      const err = error instanceof Error ? error : new Error(String(error));
      set({ error: err, isLoaded: false });
      throw err;
    }
  },

  /**
   * Reset the entire store
   */
  reset: () => {
    const currentState = get();

    // Clean up existing ad
    if (currentState.appOpenAd) {
      // Unsubscribe from all event listeners
      currentState.eventListeners.forEach((unsubscribe) => {
        try {
          unsubscribe();
        } catch (error) {
          console.warn('[AppOpenAdsStore] Error unsubscribing listener:', error);
        }
      });
    }

    set({
      appOpenAd: null,
      isLoaded: false,
      isLoading: false,
      isShowing: false,
      eventListeners: [],
      error: null,
      adLoadTime: null,
    });
  },
}));

// Convenience hooks
export const useAppOpenIsLoaded = () => useAppOpenAdsStore((state) => state.isLoaded);
export const useAppOpenIsLoading = () => useAppOpenAdsStore((state) => state.isLoading);
export const useAppOpenIsShowing = () => useAppOpenAdsStore((state) => state.isShowing);
export const useAppOpenError = () => useAppOpenAdsStore((state) => state.error);
export const useInitializeAppOpenAds = () => useAppOpenAdsStore((state) => state.initialize);
export const usePreloadAppOpenAd = () => useAppOpenAdsStore((state) => state.preloadAd);
export const useShowAppOpenAd = () => useAppOpenAdsStore((state) => state.showAd);
export const useIsAppOpenAdExpired = () => useAppOpenAdsStore((state) => state.isAdExpired);
export const useResetAppOpenAds = () => useAppOpenAdsStore((state) => state.reset);
export const useSetAppOpenForegroundSuppression = () =>
  useAppOpenAdsStore((state) => state.setSuppressNextForegroundAd);
export const useConsumeAppOpenForegroundSuppression = () =>
  useAppOpenAdsStore((state) => state.consumeForegroundSuppression);