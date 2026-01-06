import { useEffect, useRef, useState, useCallback, ReactNode } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import {
  MaxAdContentRating,
  useInitialize,
  useIsInitialized,
  useIsInitializing,
  useIsGatheringConsent,
} from '@/store/ads/mobileAdsStore';
import {
  useInitializeInterstitialAds,
  useInterstitialIsShowing,
  useInterstitialWasRecentlyClosed,
} from '@/store/ads/interstitialAdsStore';
import {
  useInitializeAppOpenAds,
  useAppOpenIsLoaded,
  useAppOpenIsLoading,
  useAppOpenIsShowing,
  useShowAppOpenAd,
  usePreloadAppOpenAd,
  useConsumeAppOpenForegroundSuppression,
} from '@/store/ads/appOpenAdsStore';
import {
  useInitializeRewardedAds,
  useRewardedWasRecentlyClosed,
  useRewardedIsShowing,
} from '@/store/ads/rewardedAdsStore';
import {
  useInitializeRewardedInterstitialAds,
  useRewardedInterstitialWasRecentlyClosed,
  useRewardedInterstitialIsShowing,
} from '@/store/ads/rewardedInterstitialAdsStore';
import { useNativeAdsPoolStore } from '@/store/ads/nativeAdsPoolStore';
import { getAdUnitId, getInterstitialCounterThreshold, areAdsEnabled } from '@/services/adConfigService';

interface AdsProviderProps {
  children: ReactNode;
}

export function AdsProvider({ children }: AdsProviderProps) {
  const initialize = useInitialize();
  const isInitialized = useIsInitialized();
  const isInitializing = useIsInitializing();
  const isGatheringConsent = useIsGatheringConsent();
  const initializeInterstitialAds = useInitializeInterstitialAds();
  const interstitialIsShowing = useInterstitialIsShowing();
  const interstitialWasRecentlyClosed = useInterstitialWasRecentlyClosed();
  
  // App open ads hooks
  const initializeAppOpenAds = useInitializeAppOpenAds();
  const appOpenIsLoaded = useAppOpenIsLoaded();
  const appOpenIsLoading = useAppOpenIsLoading();
  const appOpenIsShowing = useAppOpenIsShowing();
  const showAppOpenAd = useShowAppOpenAd();
  const preloadAppOpenAd = usePreloadAppOpenAd();
  const consumeAppOpenForegroundSuppression = useConsumeAppOpenForegroundSuppression();
  
  // Rewarded ads hooks
  const initializeRewardedAds = useInitializeRewardedAds();
  const rewardedWasRecentlyClosed = useRewardedWasRecentlyClosed();
  const rewardedIsShowing = useRewardedIsShowing();
  
  // Rewarded interstitial ads hooks
  const initializeRewardedInterstitialAds = useInitializeRewardedInterstitialAds();
  const rewardedInterstitialWasRecentlyClosed = useRewardedInterstitialWasRecentlyClosed();
  const rewardedInterstitialIsShowing = useRewardedInterstitialIsShowing();
  
  // Native ads hooks
  const initAdSystem = useNativeAdsPoolStore((state) => state.initAdSystem);
  const isNativeAdsInitialized = useNativeAdsPoolStore((state) => state.isInitialized);
  
  // Track if we've shown the app open ad for this session
  const hasShownAppOpenAd = useRef(false);
  const [splashHidden, setSplashHidden] = useState(false);
  const [adsDisabled, setAdsDisabled] = useState(false);
  
  // Track app state and timing for foreground ads
  const appState = useRef(AppState.currentState);
  const lastAdShownTime = useRef<number>(0);
  const isInitialLaunch = useRef(true);

  // Function to hide splash screen
  const hideSplashScreen = useCallback(async () => {
    if (!splashHidden) {
      setSplashHidden(true);
      try {
        await SplashScreen.hideAsync();
      } catch (error) {
        console.error('Error hiding splash screen:', error);
      }
    }
  }, [splashHidden]);

  useEffect(() => {
    if (!isInitialized) {
      initialize({
        requestConfiguration: {
          maxAdContentRating: MaxAdContentRating.G,
          tagForChildDirectedTreatment: false,
          tagForUnderAgeOfConsent: false,
        },
      })
        .then(() => {
          console.log('Mobile Ads SDK initialized successfully');
        })
        .catch((err) => {
          console.error('Failed to initialize Mobile Ads SDK:', err);
        });
    }
  }, [isInitialized, initialize]);

  // Check if ads are enabled and hide splash screen immediately if disabled
  useEffect(() => {
    if (isInitialized && !splashHidden && isInitialLaunch.current) {
      areAdsEnabled('global').then((enabled) => {
        if (!enabled) {
          console.log('[AdsProvider] Ads are disabled for global screen, hiding splash screen immediately');
          setAdsDisabled(true);
          hasShownAppOpenAd.current = true;
          isInitialLaunch.current = false;
          hideSplashScreen();
        }
      }).catch((error) => {
        console.error('[AdsProvider] Failed to check if ads are enabled:', error);
        // On error, proceed with normal flow (don't block splash screen)
      });
    }
  }, [isInitialized, splashHidden, hideSplashScreen]);

  // Initialize app open ads after Mobile Ads SDK is initialized
  useEffect(() => {
    if (isInitialized) {
      // Check if ads are enabled before initializing
      areAdsEnabled('global').then((enabled) => {
        if (!enabled) {
          console.log('[AdsProvider] Ads are disabled for global screen, skipping app open ads initialization');
          return;
        }

        // Fetch ad unit ID from Supabase
        getAdUnitId('global', 'app_open').then((adUnitId) => {
          if (!adUnitId) {
            console.log('[AdsProvider] No app open ad unit ID available, skipping initialization');
            // If no ad unit ID, hide splash screen immediately
            if (!splashHidden && isInitialLaunch.current) {
              hasShownAppOpenAd.current = true;
              isInitialLaunch.current = false;
              hideSplashScreen();
            }
            return;
          }

          // Initialize app open ads
          // This will automatically preload the first ad
          initializeAppOpenAds(adUnitId, {
            keywords: ['fashion', 'clothing'], // Optional: add keywords for better ad targeting
          });
          console.log('App open ads initialized with unit ID:', adUnitId);
        }).catch((error) => {
          console.error('Failed to fetch app open ad unit ID:', error);
          // If fetching fails, hide splash screen immediately
          if (!splashHidden && isInitialLaunch.current) {
            hasShownAppOpenAd.current = true;
            isInitialLaunch.current = false;
            hideSplashScreen();
          }
        });
      }).catch((error) => {
        console.error('Failed to check if ads are enabled:', error);
        // On error, hide splash screen to avoid blocking the app
        if (!splashHidden && isInitialLaunch.current) {
          hasShownAppOpenAd.current = true;
          isInitialLaunch.current = false;
          hideSplashScreen();
        }
      });
    }
  }, [isInitialized, initializeAppOpenAds, splashHidden, hideSplashScreen]);

  // Initialize interstitial ads after Mobile Ads SDK is initialized
  useEffect(() => {
    if (isInitialized) {
      // Check if ads are enabled before initializing
      areAdsEnabled('global').then((enabled) => {
        if (!enabled) {
          console.log('[AdsProvider] Ads are disabled for global screen, skipping interstitial ads initialization');
          return;
        }

        // Fetch ad unit ID and counter threshold from Supabase
        Promise.all([
          getAdUnitId('global', 'interstitial'),
          getInterstitialCounterThreshold(),
        ]).then(([adUnitId, counterThreshold]) => {
          if (!adUnitId) {
            console.log('[AdsProvider] No interstitial ad unit ID available, skipping initialization');
            return;
          }

          // Initialize interstitial ads
          // This will automatically preload the first ad
          initializeInterstitialAds(
            adUnitId,
            {
              keywords: ['fashion', 'clothing'], // Optional: add keywords for better ad targeting
            },
            counterThreshold
          );
          console.log('Interstitial ads initialized with unit ID:', adUnitId, 'counter threshold:', counterThreshold);
        }).catch((error) => {
          console.error('Failed to fetch interstitial ad configuration:', error);
        });
      }).catch((error) => {
        console.error('Failed to check if ads are enabled:', error);
      });
    }
  }, [isInitialized, initializeInterstitialAds]);

  // Initialize rewarded ads after Mobile Ads SDK is initialized
  useEffect(() => {
    if (isInitialized) {
      // Check if ads are enabled before initializing
      areAdsEnabled('global').then((enabled) => {
        if (!enabled) {
          console.log('[AdsProvider] Ads are disabled for global screen, skipping rewarded ads initialization');
          return;
        }

        // Fetch ad unit ID from Supabase
        getAdUnitId('global', 'rewarded').then((adUnitId) => {
          if (!adUnitId) {
            console.log('[AdsProvider] No rewarded ad unit ID available, skipping initialization');
            return;
          }

          // Initialize rewarded ads
          // This will automatically preload the first ad
          initializeRewardedAds(adUnitId, {
            keywords: ['fashion', 'clothing'], // Optional: add keywords for better ad targeting
            serverSideVerificationOptions: {
              // Optional: Add server-side verification options if needed
              // userId: 'user123',
              // customData: 'custom-data',
            },
          });
          console.log('Rewarded ads initialized with unit ID:', adUnitId);
        }).catch((error) => {
          console.error('Failed to fetch rewarded ad unit ID:', error);
        });
      }).catch((error) => {
        console.error('Failed to check if ads are enabled:', error);
      });
    }
  }, [isInitialized, initializeRewardedAds]);

  // Initialize rewarded interstitial ads after Mobile Ads SDK is initialized
  useEffect(() => {
    if (isInitialized) {
      // Check if ads are enabled before initializing
      areAdsEnabled('global').then((enabled) => {
        if (!enabled) {
          console.log('[AdsProvider] Ads are disabled for global screen, skipping rewarded interstitial ads initialization');
          return;
        }

        // Fetch ad unit ID from Supabase
        getAdUnitId('global', 'rewarded_interstitial').then((adUnitId) => {
          if (!adUnitId) {
            console.log('[AdsProvider] No rewarded interstitial ad unit ID available, skipping initialization');
            return;
          }

          // Initialize rewarded interstitial ads
          // This will automatically preload the first ad
          initializeRewardedInterstitialAds(adUnitId, {
            keywords: ['fashion', 'clothing'], // Optional: add keywords for better ad targeting
            serverSideVerificationOptions: {
              // Optional: Add server-side verification options if needed
              // userId: 'user123',
              // customData: 'custom-data',
            },
          });
          console.log('Rewarded interstitial ads initialized with unit ID:', adUnitId);
        }).catch((error) => {
          console.error('Failed to fetch rewarded interstitial ad unit ID:', error);
        });
      }).catch((error) => {
        console.error('Failed to check if ads are enabled:', error);
      });
    }
  }, [isInitialized, initializeRewardedInterstitialAds]);

  // Initialize native ads system after Mobile Ads SDK is initialized
  // Note: Native ads are screen-based, so we initialize to fetch all screen configs
  // Each screen will check if ads are enabled for that specific screen
  useEffect(() => {
    if (isInitialized && !isNativeAdsInitialized) {
      // Initialize native ads system
      // This will fetch all active configs and preload settings from Supabase
      // Each screen operation will check if ads are enabled for that specific screen
      initAdSystem()
        .then(() => {
          console.log('[AdsProvider] Native ads system initialized successfully');
        })
        .catch((error) => {
          console.error('[AdsProvider] Failed to initialize native ads system:', error);
        });
    }
  }, [isInitialized, isNativeAdsInitialized, initAdSystem]);

  // Show app open ad when loaded (only on initial launch with splash screen)
  useEffect(() => {
    if (
      isInitialized &&
      appOpenIsLoaded &&
      !appOpenIsShowing &&
      !hasShownAppOpenAd.current &&
      !splashHidden &&
      isInitialLaunch.current
    ) {
      hasShownAppOpenAd.current = true;
      lastAdShownTime.current = Date.now();
      showAppOpenAd()
        .then(() => {
          console.log('App open ad shown successfully on launch');
        })
        .catch((err) => {
          console.error('Failed to show app open ad:', err);
          // If ad fails to show, hide splash screen anyway
          hideSplashScreen();
        });
    }
  }, [isInitialized, appOpenIsLoaded, appOpenIsShowing, showAppOpenAd, splashHidden, hideSplashScreen]);

  // Hide splash screen when app open ad is closed (only on initial launch)
  useEffect(() => {
    if (hasShownAppOpenAd.current && !appOpenIsShowing && !splashHidden && isInitialLaunch.current) {
      isInitialLaunch.current = false;
      hideSplashScreen();
    }
  }, [appOpenIsShowing, splashHidden, hideSplashScreen]);

  // Fallback: Hide splash screen if ad fails to load after timeout (10 seconds)
  useEffect(() => {
    if (isInitialized && !hasShownAppOpenAd.current && !splashHidden && isInitialLaunch.current) {
      const timeout = setTimeout(() => {
        if (!appOpenIsShowing) {
          console.warn('App open ad timeout, hiding splash screen');
          hasShownAppOpenAd.current = true;
          isInitialLaunch.current = false;
          hideSplashScreen();
        }
      }, 10000); // 10 second timeout

      return () => clearTimeout(timeout);
    }
  }, [isInitialized, appOpenIsShowing, splashHidden, hideSplashScreen]);

  // Handle app state changes: show app open ad when app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active' &&
        isInitialized
      ) {
        // App has come to the foreground
        console.log('App has come to the foreground');
        
        // Mark that initial launch is complete (after first foreground transition)
        if (isInitialLaunch.current && splashHidden) {
          isInitialLaunch.current = false;
        }
        
        // Don't show ad on initial launch (already handled above)
        if (isInitialLaunch.current) {
          return;
        }

        // Skip showing ad if a foreground suppression has been requested (e.g. opening camera/image picker)
        if (consumeAppOpenForegroundSuppression()) {
          console.log('Skipping app open ad - foreground suppression active');
          return;
        }
        
        // Don't show app open ad if interstitial, rewarded, or rewarded interstitial ad is showing or was recently closed
        if (
          interstitialIsShowing ||
          interstitialWasRecentlyClosed ||
          rewardedIsShowing ||
          rewardedWasRecentlyClosed ||
          rewardedInterstitialIsShowing ||
          rewardedInterstitialWasRecentlyClosed
        ) {
          console.log('Skipping app open ad - interstitial, rewarded, or rewarded interstitial ad is active or was recently closed');
          return;
        }
        
        // Show ad if loaded and not already showing
        if (appOpenIsLoaded && !appOpenIsShowing) {
          console.log('Showing app open ad on foreground');
          lastAdShownTime.current = Date.now();
          showAppOpenAd()
            .then(() => {
              console.log('App open ad shown successfully on foreground');
            })
            .catch((err) => {
              console.error('Failed to show app open ad on foreground:', err);
            });
        } else if (!appOpenIsLoaded && !appOpenIsLoading) {
          // Preload ad if not loaded and not currently loading
          console.log('Preloading app open ad for next foreground');
          preloadAppOpenAd().catch((err) => {
            console.error('Failed to preload app open ad:', err);
          });
        }
      } else if (
        appState.current === 'active' &&
        nextAppState.match(/inactive|background/)
      ) {
        // App has gone to the background
        console.log('App has gone to the background');
        
        // Preload ad when app goes to background (for next foreground)
        if (isInitialized && !appOpenIsLoaded && !appOpenIsLoading) {
          console.log('Preloading app open ad while app is in background');
          preloadAppOpenAd().catch((err) => {
            console.error('Failed to preload app open ad in background:', err);
          });
        }
      }

      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [isInitialized, appOpenIsLoaded, appOpenIsLoading, appOpenIsShowing, showAppOpenAd, preloadAppOpenAd, splashHidden, interstitialIsShowing, interstitialWasRecentlyClosed, rewardedIsShowing, rewardedWasRecentlyClosed, rewardedInterstitialIsShowing, rewardedInterstitialWasRecentlyClosed]);

  // Show loading indicator while initializing or gathering consent
  // Note: Splash screen will be visible during this time
  if (isInitializing || isGatheringConsent || !isInitialized) {
    return null; // Return null to keep splash screen visible
  }

  // Show loading indicator while app open ad is loading (only on first launch)
  // Skip this check if ads are disabled (splash screen already hidden)
  if (!adsDisabled && !hasShownAppOpenAd.current && (appOpenIsLoading || !appOpenIsLoaded)) {
    return null; // Return null to keep splash screen visible
  }

  return <>{children}</>;
}