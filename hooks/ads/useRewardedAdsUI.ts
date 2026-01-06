import { useCallback, useMemo } from 'react';

import {
  useShowRewardedAd,
  useRewardedIsLoaded,
  useRewardedIsShowing,
  useRewardedLastReward,
  type Reward as RewardPayload,
} from '@/store/ads/rewardedAdsStore';
import {
  useShowRewardedInterstitialAd,
  useRewardedInterstitialIsLoaded,
  useRewardedInterstitialIsShowing,
  useRewardedInterstitialLastReward,
} from '@/store/ads/rewardedInterstitialAdsStore';

interface RewardedButtonState {
  isLoaded: boolean;
  isShowing: boolean;
  disabled: boolean;
  label: string;
  show: () => Promise<boolean>;
  lastReward: RewardPayload | null;
}

interface UseRewardedAdsUIResult {
  rewarded: RewardedButtonState;
  rewardedInterstitial: RewardedButtonState;
}

export const useRewardedAdsUI = (): UseRewardedAdsUIResult => {
  const showRewardedAd = useShowRewardedAd();
  const rewardedIsLoaded = useRewardedIsLoaded();
  const rewardedIsShowing = useRewardedIsShowing();
  const rewardedLastReward = useRewardedLastReward();

  const showRewardedInterstitialAd = useShowRewardedInterstitialAd();
  const rewardedInterstitialIsLoaded = useRewardedInterstitialIsLoaded();
  const rewardedInterstitialIsShowing = useRewardedInterstitialIsShowing();
  const rewardedInterstitialLastReward = useRewardedInterstitialLastReward();

  const handleShowRewardedAd = useCallback(async (): Promise<boolean> => {
    if (!rewardedIsLoaded || rewardedIsShowing) {
      return false;
    }

    try {
      await showRewardedAd();
      return true;
    } catch (error) {
      console.warn('[RewardScreen] Failed to show rewarded ad:', error);
      return false;
    }
  }, [rewardedIsLoaded, rewardedIsShowing, showRewardedAd]);

  const handleShowRewardedInterstitialAd = useCallback(async (): Promise<boolean> => {
    if (!rewardedInterstitialIsLoaded || rewardedInterstitialIsShowing) {
      return false;
    }

    try {
      await showRewardedInterstitialAd();
      return true;
    } catch (error) {
      console.warn('[RewardScreen] Failed to show rewarded interstitial ad:', error);
      return false;
    }
  }, [rewardedInterstitialIsLoaded, rewardedInterstitialIsShowing, showRewardedInterstitialAd]);

  const rewardedLabel = useMemo(() => {
    if (rewardedIsShowing) {
      return 'Showing Rewarded Ad...';
    }
    if (rewardedIsLoaded) {
      return '🎁 Watch Rewarded Ad';
    }
    return 'Rewarded Ad Loading...';
  }, [rewardedIsLoaded, rewardedIsShowing]);

  const rewardedInterstitialLabel = useMemo(() => {
    if (rewardedInterstitialIsShowing) {
      return 'Showing Rewarded Interstitial...';
    }
    if (rewardedInterstitialIsLoaded) {
      return '🎯 Watch Rewarded Interstitial';
    }
    return 'Rewarded Interstitial Loading...';
  }, [rewardedInterstitialIsLoaded, rewardedInterstitialIsShowing]);

  return {
    rewarded: {
      isLoaded: rewardedIsLoaded,
      isShowing: rewardedIsShowing,
      disabled: !rewardedIsLoaded || rewardedIsShowing,
      label: rewardedLabel,
      show: handleShowRewardedAd,
      lastReward: rewardedLastReward,
    },
    rewardedInterstitial: {
      isLoaded: rewardedInterstitialIsLoaded,
      isShowing: rewardedInterstitialIsShowing,
      disabled: !rewardedInterstitialIsLoaded || rewardedInterstitialIsShowing,
      label: rewardedInterstitialLabel,
      show: handleShowRewardedInterstitialAd,
      lastReward: rewardedInterstitialLastReward,
    },
  };
};

