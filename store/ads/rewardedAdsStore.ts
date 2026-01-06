import { create } from 'zustand';
import {
  RewardedAd,
  RewardedAdEventType,
  AdEventType,
} from 'react-native-google-mobile-ads';
import { areAdsEnabled } from '@/services/adConfigService';

// Request options type based on documentation
// The second parameter is an optional object with properties like keywords, location, serverSideVerificationOptions, etc.
type RewardedAdRequestOptions = {
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

interface RewardedAdState {
  // Ad instance
  rewardedAd: RewardedAd | null;
  isLoaded: boolean;
  isLoading: boolean;
  isShowing: boolean;
  wasRecentlyClosed: boolean; // Track if ad was recently closed to prevent app open ads

  // Configuration
  adUnitId: string;
  requestOptions: RewardedAdRequestOptions | undefined;

  // Event listeners
  eventListeners: AdEventListener[];

  // Error handling
  error: Error | null;

  // Reward tracking
  lastReward: Reward | null;

  // Methods
  initialize: (adUnitId?: string, requestOptions?: RewardedAdRequestOptions) => void;
  preloadAd: () => Promise<void>;
  showAd: () => Promise<void>;
  reset: () => void;
}

export const useRewardedAdsStore = create<RewardedAdState>((set, get) => ({
  rewardedAd: null,
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
   * Initialize the rewarded ads store
   */
  initialize: (adUnitId, requestOptions) => {
    const currentState = get();
    
    // Don't initialize if adUnitId is empty or invalid
    if (!adUnitId || adUnitId.trim() === '') {
      console.log('[RewardedAdsStore] No ad unit ID provided, skipping initialization');
      return;
    }
    
    // Don't reinitialize if already initialized with the same config
    if (
      currentState.rewardedAd &&
      currentState.adUnitId === adUnitId
    ) {
      return;
    }

    // Clean up existing ad if any
    if (currentState.rewardedAd) {
      // Unsubscribe from all event listeners
      currentState.eventListeners.forEach((unsubscribe) => {
        try {
          unsubscribe();
        } catch (error) {
          console.warn('[RewardedAdsStore] Error unsubscribing listener:', error);
        }
      });
    }

    set({
      adUnitId: adUnitId || '',
      requestOptions,
      rewardedAd: null,
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
        console.error('[RewardedAdsStore] Failed to preload initial ad:', error);
      });
    }
  },

  /**
   * Preload a rewarded ad
   * This ensures we always have 1 ad ready
   */
  preloadAd: async () => {
    const currentState = get();

    // Check if adUnitId is valid before preloading
    if (!currentState.adUnitId || currentState.adUnitId.trim() === '') {
      console.log('[RewardedAdsStore] No ad unit ID available, skipping ad preload');
      return;
    }

    // Check if ads are enabled before preloading
    const adsEnabled = await areAdsEnabled('global');
    if (!adsEnabled) {
      console.log('[RewardedAdsStore] Ads are disabled for global screen, skipping ad preload');
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
      if (currentState.rewardedAd) {
        // Unsubscribe from all event listeners
        currentState.eventListeners.forEach((unsubscribe) => {
          try {
            unsubscribe();
          } catch (error) {
            console.warn('[RewardedAdsStore] Error unsubscribing listener:', error);
          }
        });
      }

      // Create new rewarded ad
      const rewardedAd = RewardedAd.createForAdRequest(
        currentState.adUnitId,
        currentState.requestOptions
      );

      // Set up event listeners
      const eventListeners: AdEventListener[] = [];

      // Ad loaded event - using RewardedAdEventType.LOADED as per documentation
      const unsubscribeLoaded = rewardedAd.addAdEventListener(RewardedAdEventType.LOADED, () => {
        console.log('[RewardedAdsStore] Ad loaded successfully');
        set({ isLoaded: true, isLoading: false, error: null });
      });

      // Ad error event - using AdEventType.ERROR (RewardedAdEventType doesn't have ERROR)
      const unsubscribeError = rewardedAd.addAdEventListener(AdEventType.ERROR, (errorEvent) => {
        console.error('[RewardedAdsStore] Ad error:', errorEvent);
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
      const unsubscribeOpened = rewardedAd.addAdEventListener(AdEventType.OPENED, () => {
        console.log('[RewardedAdsStore] Ad opened');
        set({ isShowing: true });
      });

      // Reward earned event - specific to rewarded ads
      const unsubscribeEarned = rewardedAd.addAdEventListener(
        RewardedAdEventType.EARNED_REWARD,
        (reward: Reward) => {
          console.log('[RewardedAdsStore] User earned reward:', reward);
          set({ lastReward: reward });
        }
      );

      // Ad closed event - preload next ad immediately
      // Using AdEventType.CLOSED (RewardedAdEventType doesn't have CLOSED)
      const unsubscribeClosed = rewardedAd.addAdEventListener(AdEventType.CLOSED, () => {
        console.log('[RewardedAdsStore] Ad closed');
        
        // Clean up the current ad instance
        const stateAfterClose = get();
        if (stateAfterClose.rewardedAd) {
          // Unsubscribe from all event listeners
          stateAfterClose.eventListeners.forEach((unsubscribe) => {
            try {
              unsubscribe();
            } catch (error) {
              console.warn('[RewardedAdsStore] Error unsubscribing listener on close:', error);
            }
          });
        }
        
        // Reset state completely before preloading next ad
        // Mark as recently closed to prevent app open ads from showing
        set({ 
          isShowing: false, 
          isLoaded: false, 
          rewardedAd: null, 
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
              console.error('[RewardedAdsStore] Failed to preload next ad after close:', error);
            });
          }
        }, 0);
      });

      eventListeners.push(unsubscribeLoaded, unsubscribeError, unsubscribeOpened, unsubscribeEarned, unsubscribeClosed);

      set({
        rewardedAd,
        eventListeners,
      });

      // Load the ad
      await rewardedAd.load();
    } catch (error) {
      console.error('[RewardedAdsStore] Failed to create/load ad:', error);
      const err = error instanceof Error ? error : new Error(String(error));
      set({
        isLoading: false,
        isLoaded: false,
        error: err,
        rewardedAd: null,
        eventListeners: [],
      });
    }
  },

  /**
   * Show the preloaded rewarded ad
   */
  showAd: async () => {
    const currentState = get();

    // Check if ads are enabled before showing
    const adsEnabled = await areAdsEnabled('global');
    if (!adsEnabled) {
      console.log('[RewardedAdsStore] Ads are disabled for global screen, skipping ad show');
      throw new Error('Ads are disabled');
    }

    if (!currentState.rewardedAd) {
      throw new Error('No rewarded ad available');
    }

    if (!currentState.isLoaded) {
      throw new Error('Rewarded ad is not loaded yet');
    }

    if (currentState.isShowing) {
      throw new Error('Rewarded ad is already showing');
    }

    try {
      // Reset last reward before showing
      set({ lastReward: null });
      await currentState.rewardedAd.show();
    } catch (error) {
      console.error('[RewardedAdsStore] Failed to show ad:', error);
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
    if (currentState.rewardedAd) {
      // Unsubscribe from all event listeners
      currentState.eventListeners.forEach((unsubscribe) => {
        try {
          unsubscribe();
        } catch (error) {
          console.warn('[RewardedAdsStore] Error unsubscribing listener:', error);
        }
      });
    }

    set({
      rewardedAd: null,
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
export const useRewardedIsLoaded = () => useRewardedAdsStore((state) => state.isLoaded);
export const useRewardedIsLoading = () => useRewardedAdsStore((state) => state.isLoading);
export const useRewardedIsShowing = () => useRewardedAdsStore((state) => state.isShowing);
export const useRewardedWasRecentlyClosed = () => useRewardedAdsStore((state) => state.wasRecentlyClosed);
export const useRewardedError = () => useRewardedAdsStore((state) => state.error);
export const useRewardedLastReward = () => useRewardedAdsStore((state) => state.lastReward);
export const useInitializeRewardedAds = () => useRewardedAdsStore((state) => state.initialize);
export const usePreloadRewardedAd = () => useRewardedAdsStore((state) => state.preloadAd);
export const useShowRewardedAd = () => useRewardedAdsStore((state) => state.showAd);
export const useResetRewardedAds = () => useRewardedAdsStore((state) => state.reset);

