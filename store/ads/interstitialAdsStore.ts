import { create } from 'zustand';
import {
  InterstitialAd,
  AdEventType,
} from 'react-native-google-mobile-ads';
import { areAdsEnabled } from '@/services/adConfigService';

// Request options type based on documentation
// The second parameter is an optional object with properties like keywords, location, etc.
type InterstitialAdRequestOptions = {
  keywords?: string[];
  location?: { latitude: number; longitude: number };
  [key: string]: any; // Allow other optional properties
};

// Type for event listener unsubscribe function returned by addAdEventListener
type AdEventListener = () => void;

interface InterstitialAdState {
  // Ad instance
  interstitialAd: InterstitialAd | null;
  isLoaded: boolean;
  isLoading: boolean;
  isShowing: boolean;
  wasRecentlyClosed: boolean; // Track if ad was recently closed to prevent app open ads

  // Counter state
  counter: number;
  counterThreshold: number; // Show ad after this many interactions

  // Configuration
  adUnitId: string;
  requestOptions: InterstitialAdRequestOptions | undefined;

  // Event listeners
  eventListeners: AdEventListener[];

  // Error handling
  error: Error | null;

  // Methods
  initialize: (adUnitId?: string, requestOptions?: InterstitialAdRequestOptions, counterThreshold?: number) => void;
  incrementCounter: () => Promise<boolean>; // Returns true if ad was shown
  preloadAd: () => Promise<void>;
  showAd: () => Promise<void>;
  resetCounter: () => void;
  reset: () => void;
}

export const useInterstitialAdsStore = create<InterstitialAdState>((set, get) => ({
  interstitialAd: null,
  isLoaded: false,
  isLoading: false,
  isShowing: false,
  wasRecentlyClosed: false,
  counter: 0,
  counterThreshold: 2,
  adUnitId: '',
  requestOptions: undefined,
  eventListeners: [],
  error: null,

  /**
   * Initialize the interstitial ads store
   */
  initialize: (adUnitId, requestOptions, counterThreshold = 2) => {
    const currentState = get();
    
    // Don't initialize if adUnitId is empty or invalid
    if (!adUnitId || adUnitId.trim() === '') {
      console.log('[InterstitialAdsStore] No ad unit ID provided, skipping initialization');
      return;
    }
    
    // Don't reinitialize if already initialized with the same config
    if (
      currentState.interstitialAd &&
      currentState.adUnitId === adUnitId &&
      currentState.counterThreshold === counterThreshold
    ) {
      return;
    }

    // Clean up existing ad if any
    if (currentState.interstitialAd) {
      // Unsubscribe from all event listeners
      currentState.eventListeners.forEach((unsubscribe) => {
        try {
          unsubscribe();
        } catch (error) {
          console.warn('[InterstitialAdsStore] Error unsubscribing listener:', error);
        }
      });
    }

    set({
      adUnitId: adUnitId || '',
      requestOptions,
      counterThreshold,
      counter: 0,
      interstitialAd: null,
      isLoaded: false,
      isLoading: false,
      isShowing: false,
      wasRecentlyClosed: false,
      eventListeners: [],
      error: null,
    });

    // Preload the first ad only if adUnitId is valid
    if (adUnitId && adUnitId.trim() !== '') {
      get().preloadAd().catch((error) => {
        console.error('[InterstitialAdsStore] Failed to preload initial ad:', error);
      });
    }
  },

  /**
   * Increment the counter and show ad if threshold is reached
   * Returns true if ad was shown, false otherwise
   */
  incrementCounter: async () => {
    const currentState = get();
    const newCounter = currentState.counter + 1;

    set({ counter: newCounter });

    // Check if we've reached the threshold
    if (newCounter >= currentState.counterThreshold) {
      // Reset counter first
      set({ counter: 0 });

      // Check if ads are enabled before showing
      const adsEnabled = await areAdsEnabled('global');
      
      if (!adsEnabled) {
        console.log('[InterstitialAdsStore] Ads are disabled for global screen, skipping ad show');
        return false;
      }

      // Show ad if loaded
      if (currentState.isLoaded && currentState.interstitialAd && !currentState.isShowing) {
        try {
          await get().showAd();
          return true;
        } catch (error) {
          console.error('[InterstitialAdsStore] Failed to show ad:', error);
          // Preload a new ad even if showing failed (only if ads are enabled)
          if (adsEnabled) {
            get().preloadAd().catch((err) => {
              console.error('[InterstitialAdsStore] Failed to preload after show error:', err);
            });
          }
          return false;
        }
      } else {
        // Ad not ready, but we still reset counter
        // Preload an ad for next time (only if ads are enabled)
        if (adsEnabled && !currentState.isLoading) {
          get().preloadAd().catch((error) => {
            console.error('[InterstitialAdsStore] Failed to preload ad:', error);
          });
        }
        return false;
      }
    }

    return false;
  },

  /**
   * Preload an interstitial ad
   * This ensures we always have 1 ad ready
   */
  preloadAd: async () => {
    const currentState = get();

    // Check if adUnitId is valid before preloading
    if (!currentState.adUnitId || currentState.adUnitId.trim() === '') {
      console.log('[InterstitialAdsStore] No ad unit ID available, skipping ad preload');
      return;
    }

    // Check if ads are enabled before preloading
    const adsEnabled = await areAdsEnabled('global');
    
    if (!adsEnabled) {
      console.log('[InterstitialAdsStore] Ads are disabled for global screen, skipping ad preload');
      return;
    }

    // Don't preload if already loading or already loaded
    if (currentState.isLoading || currentState.isLoaded) {
      return;
    }

    // Don't preload if currently showing
    if (currentState.isShowing) {
      return;
    }

    set({ isLoading: true, error: null });

    try {
      // Clean up existing ad if any
      if (currentState.interstitialAd) {
        // Unsubscribe from all event listeners
        currentState.eventListeners.forEach((unsubscribe) => {
          try {
            unsubscribe();
          } catch (error) {
            console.warn('[InterstitialAdsStore] Error unsubscribing listener:', error);
          }
        });
      }

      // Create new interstitial ad
      const interstitialAd = InterstitialAd.createForAdRequest(
        currentState.adUnitId,
        currentState.requestOptions
      );

      // Set up event listeners
      const eventListeners: AdEventListener[] = [];

      // Ad loaded event - using AdEventType.LOADED as per documentation
      const unsubscribeLoaded = interstitialAd.addAdEventListener(AdEventType.LOADED, () => {
        console.log('[InterstitialAdsStore] Ad loaded successfully');
        set({ isLoaded: true, isLoading: false, error: null });
      });

      // Ad error event
      const unsubscribeError = interstitialAd.addAdEventListener(AdEventType.ERROR, (errorEvent) => {
        console.error('[InterstitialAdsStore] Ad error:', errorEvent);
        // Error event structure may vary, handle both Error objects and event objects
        const err =
          errorEvent instanceof Error
            ? errorEvent
            : (errorEvent as any)?.error instanceof Error
              ? (errorEvent as any).error
              : new Error(String((errorEvent as any)?.error || errorEvent || 'Unknown error'));
        set({ isLoading: false, isLoaded: false, error: err });
      });

      // Ad opened event - using AdEventType.OPENED as per documentation
      const unsubscribeOpened = interstitialAd.addAdEventListener(AdEventType.OPENED, () => {
        console.log('[InterstitialAdsStore] Ad opened');
        set({ isShowing: true, wasRecentlyClosed: false });
      });

      // Ad closed event - preload next ad immediately
      // Using AdEventType.CLOSED as per documentation
      const unsubscribeClosed = interstitialAd.addAdEventListener(AdEventType.CLOSED, () => {
        console.log('[InterstitialAdsStore] Ad closed');
        
        // Clean up the current ad instance
        const stateAfterClose = get();
        if (stateAfterClose.interstitialAd) {
          // Unsubscribe from all event listeners
          stateAfterClose.eventListeners.forEach((unsubscribe) => {
            try {
              unsubscribe();
            } catch (error) {
              console.warn('[InterstitialAdsStore] Error unsubscribing listener on close:', error);
            }
          });
        }
        
        // Mark as recently closed to prevent app open ads from showing
        set({ 
          isShowing: false, 
          isLoaded: false, 
          interstitialAd: null, 
          eventListeners: [],
          wasRecentlyClosed: true,
        });
        
        // Reset the flag after 2 seconds to allow app open ads again
        setTimeout(() => {
          set({ wasRecentlyClosed: false });
        }, 2000);
        
        // Immediately preload next ad
        get().preloadAd().catch((error) => {
          console.error('[InterstitialAdsStore] Failed to preload next ad after close:', error);
        });
      });

      eventListeners.push(unsubscribeLoaded, unsubscribeError, unsubscribeOpened, unsubscribeClosed);

      set({
        interstitialAd,
        eventListeners,
      });

      // Load the ad
      await interstitialAd.load();
    } catch (error) {
      console.error('[InterstitialAdsStore] Failed to create/load ad:', error);
      const err = error instanceof Error ? error : new Error(String(error));
      set({
        isLoading: false,
        isLoaded: false,
        error: err,
        interstitialAd: null,
        eventListeners: [],
      });
    }
  },

  /**
   * Show the preloaded interstitial ad
   */
  showAd: async () => {
    const currentState = get();

    // Check if ads are enabled before showing
    const adsEnabled = await areAdsEnabled('global');
    
    if (!adsEnabled) {
      console.log('[InterstitialAdsStore] Ads are disabled for global screen, skipping ad show');
      throw new Error('Ads are disabled');
    }

    if (!currentState.interstitialAd) {
      throw new Error('No interstitial ad available');
    }

    if (!currentState.isLoaded) {
      throw new Error('Interstitial ad is not loaded yet');
    }

    if (currentState.isShowing) {
      throw new Error('Interstitial ad is already showing');
    }

    try {
      await currentState.interstitialAd.show();
    } catch (error) {
      console.error('[InterstitialAdsStore] Failed to show ad:', error);
      const err = error instanceof Error ? error : new Error(String(error));
      set({ error: err, isLoaded: false });
      throw err;
    }
  },

  /**
   * Reset the counter manually
   */
  resetCounter: () => {
    set({ counter: 0 });
  },

  /**
   * Reset the entire store
   */
  reset: () => {
    const currentState = get();

    // Clean up existing ad
    if (currentState.interstitialAd) {
      // Unsubscribe from all event listeners
      currentState.eventListeners.forEach((unsubscribe) => {
        try {
          unsubscribe();
        } catch (error) {
          console.warn('[InterstitialAdsStore] Error unsubscribing listener:', error);
        }
      });
    }

    set({
      interstitialAd: null,
      isLoaded: false,
      isLoading: false,
      isShowing: false,
      wasRecentlyClosed: false,
      counter: 0,
      eventListeners: [],
      error: null,
    });
  },
}));

// Convenience hooks
export const useInterstitialCounter = () => useInterstitialAdsStore((state) => state.counter);
export const useInterstitialIsLoaded = () => useInterstitialAdsStore((state) => state.isLoaded);
export const useInterstitialIsLoading = () => useInterstitialAdsStore((state) => state.isLoading);
export const useInterstitialIsShowing = () => useInterstitialAdsStore((state) => state.isShowing);
export const useInterstitialWasRecentlyClosed = () => useInterstitialAdsStore((state) => state.wasRecentlyClosed);
export const useInterstitialError = () => useInterstitialAdsStore((state) => state.error);
export const useIncrementInterstitialCounter = () => useInterstitialAdsStore((state) => state.incrementCounter);
export const useInitializeInterstitialAds = () => useInterstitialAdsStore((state) => state.initialize);
export const usePreloadInterstitialAd = () => useInterstitialAdsStore((state) => state.preloadAd);
export const useShowInterstitialAd = () => useInterstitialAdsStore((state) => state.showAd);
export const useResetInterstitialCounter = () => useInterstitialAdsStore((state) => state.resetCounter);
export const useResetInterstitialAds = () => useInterstitialAdsStore((state) => state.reset);

