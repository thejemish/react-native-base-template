import { create } from 'zustand';
import {
  RewardedInterstitialAd,
  RewardedAdEventType,
  AdEventType,
} from 'react-native-google-mobile-ads';
import { areAdsEnabled } from '@/services/adConfigService';

// Request options type based on documentation
// The second parameter is an optional object with properties like keywords, location, serverSideVerificationOptions, etc.
type RewardedInterstitialAdRequestOptions = {
  keywords?: string[];
  location?: { latitude: number; longitude: number };
  serverSideVerificationOptions?: {
    userId?: string;
    customData?: string;
  };
  [key: string]: any; // Allow other optional properties
};

// Type for event listener unsubscribe function returned by addAdEventListener
type AdEventListener = () => void;

// Reward type from the EARNED_REWARD event
export interface Reward {
  amount: number;
  type: string;
}

interface RewardedInterstitialAdState {
  // Ad instance
  rewardedInterstitialAd: RewardedInterstitialAd | null;
  isLoaded: boolean;
  isLoading: boolean;
  isShowing: boolean;
  wasRecentlyClosed: boolean; // Track if ad was recently closed to prevent app open ads

  // Configuration
  adUnitId: string;
  requestOptions: RewardedInterstitialAdRequestOptions | undefined;

  // Event listeners
  eventListeners: AdEventListener[];

  // Error handling
  error: Error | null;

  // Reward tracking
  lastReward: Reward | null;

  // Methods
  initialize: (adUnitId?: string, requestOptions?: RewardedInterstitialAdRequestOptions) => void;
  preloadAd: () => Promise<void>;
  showAd: () => Promise<void>;
  reset: () => void;
}

export const useRewardedInterstitialAdsStore = create<RewardedInterstitialAdState>((set, get) => ({
  rewardedInterstitialAd: null,
  isLoaded: false,
  isLoading: false,
  isShowing: false,
  wasRecentlyClosed: false,
  adUnitId: '',
  requestOptions: undefined,
  eventListeners: [],
  error: null,
  lastReward: null,

  /**
   * Initialize the rewarded interstitial ads store
   */
  initialize: (adUnitId, requestOptions) => {
    const currentState = get();
    
    // Don't initialize if adUnitId is empty or invalid
    if (!adUnitId || adUnitId.trim() === '') {
      console.log('[RewardedInterstitialAdsStore] No ad unit ID provided, skipping initialization');
      return;
    }
    
    // Don't reinitialize if already initialized with the same config
    if (
      currentState.rewardedInterstitialAd &&
      currentState.adUnitId === adUnitId
    ) {
      return;
    }

    // Clean up existing ad if any
    if (currentState.rewardedInterstitialAd) {
      // Unsubscribe from all event listeners
      currentState.eventListeners.forEach((unsubscribe) => {
        try {
          unsubscribe();
        } catch (error) {
          console.warn('[RewardedInterstitialAdsStore] Error unsubscribing listener:', error);
        }
      });
    }

    set({
      adUnitId: adUnitId || '',
      requestOptions,
      rewardedInterstitialAd: null,
      isLoaded: false,
      isLoading: false,
      isShowing: false,
      wasRecentlyClosed: false,
      eventListeners: [],
      error: null,
      lastReward: null,
    });

    // Preload the first ad only if adUnitId is valid
    if (adUnitId && adUnitId.trim() !== '') {
      get().preloadAd().catch((error) => {
        console.error('[RewardedInterstitialAdsStore] Failed to preload initial ad:', error);
      });
    }
  },

  /**
   * Preload a rewarded interstitial ad
   * This ensures we always have 1 ad ready
   */
  preloadAd: async () => {
    const currentState = get();

    // Check if adUnitId is valid before preloading
    if (!currentState.adUnitId || currentState.adUnitId.trim() === '') {
      console.log('[RewardedInterstitialAdsStore] No ad unit ID available, skipping ad preload');
      return;
    }

    // Check if ads are enabled before preloading
    const adsEnabled = await areAdsEnabled('global');
    if (!adsEnabled) {
      console.log('[RewardedInterstitialAdsStore] Ads are disabled for global screen, skipping ad preload');
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
      if (currentState.rewardedInterstitialAd) {
        // Unsubscribe from all event listeners
        currentState.eventListeners.forEach((unsubscribe) => {
          try {
            unsubscribe();
          } catch (error) {
            console.warn('[RewardedInterstitialAdsStore] Error unsubscribing listener:', error);
          }
        });
      }

      // Create new rewarded interstitial ad
      const rewardedInterstitialAd = RewardedInterstitialAd.createForAdRequest(
        currentState.adUnitId,
        currentState.requestOptions
      );

      // Set up event listeners
      const eventListeners: AdEventListener[] = [];

      // Ad loaded event - using RewardedAdEventType.LOADED as per documentation
      const unsubscribeLoaded = rewardedInterstitialAd.addAdEventListener(RewardedAdEventType.LOADED, () => {
        console.log('[RewardedInterstitialAdsStore] Ad loaded successfully');
        set({ isLoaded: true, isLoading: false, error: null });
      });

      // Ad error event - using AdEventType.ERROR (RewardedAdEventType doesn't have ERROR)
      const unsubscribeError = rewardedInterstitialAd.addAdEventListener(AdEventType.ERROR, (errorEvent) => {
        console.error('[RewardedInterstitialAdsStore] Ad error:', errorEvent);
        // Error event structure may vary, handle both Error objects and event objects
        const err =
          errorEvent instanceof Error
            ? errorEvent
            : (errorEvent as any)?.error instanceof Error
              ? (errorEvent as any).error
              : new Error(String((errorEvent as any)?.error || errorEvent || 'Unknown error'));
        set({ isLoading: false, isLoaded: false, error: err });
      });

      // Ad opened event - using AdEventType.OPENED (RewardedAdEventType doesn't have OPENED)
      const unsubscribeOpened = rewardedInterstitialAd.addAdEventListener(AdEventType.OPENED, () => {
        console.log('[RewardedInterstitialAdsStore] Ad opened');
        set({ isShowing: true });
      });

      // Reward earned event - specific to rewarded interstitial ads
      const unsubscribeEarned = rewardedInterstitialAd.addAdEventListener(
        RewardedAdEventType.EARNED_REWARD,
        (reward: Reward) => {
          console.log('[RewardedInterstitialAdsStore] User earned reward:', reward);
          set({ lastReward: reward });
        }
      );

      // Ad closed event - preload next ad immediately
      // Using AdEventType.CLOSED (RewardedAdEventType doesn't have CLOSED)
      const unsubscribeClosed = rewardedInterstitialAd.addAdEventListener(AdEventType.CLOSED, () => {
        console.log('[RewardedInterstitialAdsStore] Ad closed');
        
        // Clean up the current ad instance
        const stateAfterClose = get();
        if (stateAfterClose.rewardedInterstitialAd) {
          // Unsubscribe from all event listeners
          stateAfterClose.eventListeners.forEach((unsubscribe) => {
            try {
              unsubscribe();
            } catch (error) {
              console.warn('[RewardedInterstitialAdsStore] Error unsubscribing listener on close:', error);
            }
          });
        }
        
        // Reset state completely before preloading next ad
        // Mark as recently closed to prevent app open ads from showing
        set({ 
          isShowing: false, 
          isLoaded: false, 
          rewardedInterstitialAd: null, 
          eventListeners: [],
          lastReward: null, // Reset reward after ad is closed
          wasRecentlyClosed: true,
        });
        
        // Reset the flag after 2 seconds to allow app open ads again
        setTimeout(() => {
          set({ wasRecentlyClosed: false });
        }, 2000);
        
        // Immediately preload next ad after a brief delay to ensure state is reset
        // Check if ads are enabled before preloading
        setTimeout(async () => {
          const adsEnabled = await areAdsEnabled('global');
          if (adsEnabled) {
            get().preloadAd().catch((error) => {
              console.error('[RewardedInterstitialAdsStore] Failed to preload next ad after close:', error);
            });
          }
        }, 0);
      });

      eventListeners.push(unsubscribeLoaded, unsubscribeError, unsubscribeOpened, unsubscribeEarned, unsubscribeClosed);

      set({
        rewardedInterstitialAd,
        eventListeners,
      });

      // Load the ad
      await rewardedInterstitialAd.load();
    } catch (error) {
      console.error('[RewardedInterstitialAdsStore] Failed to create/load ad:', error);
      const err = error instanceof Error ? error : new Error(String(error));
      set({
        isLoading: false,
        isLoaded: false,
        error: err,
        rewardedInterstitialAd: null,
        eventListeners: [],
      });
    }
  },

  /**
   * Show the preloaded rewarded interstitial ad
   */
  showAd: async () => {
    const currentState = get();

    // Check if ads are enabled before showing
    const adsEnabled = await areAdsEnabled('global');
    if (!adsEnabled) {
      console.log('[RewardedInterstitialAdsStore] Ads are disabled for global screen, skipping ad show');
      throw new Error('Ads are disabled');
    }

    if (!currentState.rewardedInterstitialAd) {
      throw new Error('No rewarded interstitial ad available');
    }

    if (!currentState.isLoaded) {
      throw new Error('Rewarded interstitial ad is not loaded yet');
    }

    if (currentState.isShowing) {
      throw new Error('Rewarded interstitial ad is already showing');
    }

    try {
      // Reset last reward before showing
      set({ lastReward: null });
      await currentState.rewardedInterstitialAd.show();
    } catch (error) {
      console.error('[RewardedInterstitialAdsStore] Failed to show ad:', error);
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
    if (currentState.rewardedInterstitialAd) {
      // Unsubscribe from all event listeners
      currentState.eventListeners.forEach((unsubscribe) => {
        try {
          unsubscribe();
        } catch (error) {
          console.warn('[RewardedInterstitialAdsStore] Error unsubscribing listener:', error);
        }
      });
    }

    set({
      rewardedInterstitialAd: null,
      isLoaded: false,
      isLoading: false,
      isShowing: false,
      wasRecentlyClosed: false,
      eventListeners: [],
      error: null,
      lastReward: null,
    });
  },
}));

// Convenience hooks
export const useRewardedInterstitialIsLoaded = () => useRewardedInterstitialAdsStore((state) => state.isLoaded);
export const useRewardedInterstitialIsLoading = () => useRewardedInterstitialAdsStore((state) => state.isLoading);
export const useRewardedInterstitialIsShowing = () => useRewardedInterstitialAdsStore((state) => state.isShowing);
export const useRewardedInterstitialWasRecentlyClosed = () => useRewardedInterstitialAdsStore((state) => state.wasRecentlyClosed);
export const useRewardedInterstitialError = () => useRewardedInterstitialAdsStore((state) => state.error);
export const useRewardedInterstitialLastReward = () => useRewardedInterstitialAdsStore((state) => state.lastReward);
export const useInitializeRewardedInterstitialAds = () => useRewardedInterstitialAdsStore((state) => state.initialize);
export const usePreloadRewardedInterstitialAd = () => useRewardedInterstitialAdsStore((state) => state.preloadAd);
export const useShowRewardedInterstitialAd = () => useRewardedInterstitialAdsStore((state) => state.showAd);
export const useResetRewardedInterstitialAds = () => useRewardedInterstitialAdsStore((state) => state.reset);

