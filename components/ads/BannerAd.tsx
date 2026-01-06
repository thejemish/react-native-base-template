import React, { useRef } from 'react';
import { Platform, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import {
  BannerAd as GoogleBannerAd,
  BannerAdSize,
  useForeground,
  type RequestOptions,
} from 'react-native-google-mobile-ads';

export interface BannerAdProps {
  /**
   * Ad unit ID. Required.
   */
  unitId?: string;
  /**
   * Banner ad size as a string. Common values: 'ANCHORED_ADAPTIVE_BANNER', 'LARGE_BANNER', 'BANNER', 'FULL_BANNER', 'LEADERBOARD', 'MEDIUM_RECTANGLE', 'WIDE_SKYSCRAPER', 'ADAPTIVE_BANNER'.
   * Defaults to 'ANCHORED_ADAPTIVE_BANNER'.
   */
  size?: string;
  /**
   * Additional request options for ad targeting.
   */
  requestOptions?: RequestOptions;
  /**
   * Callback when ad is closed.
   */
  onAdClosed?: () => void;
  /**
   * Callback when ad fails to load.
   */
  onAdFailedToLoad?: (error: Error) => void;
  /**
   * Callback when ad is opened.
   */
  onAdOpened?: () => void;
  /**
   * Callback when ad impression is recorded.
   */
  onAdImpression?: () => void;
  /**
   * Callback when ad is clicked.
   */
  onAdClicked?: () => void;
  /**
   * Callback for impression-level ad revenue events.
   */
  onPaid?: (event: {
    value: number;
    currency: string;
    precision: number;
  }) => void;
  /**
   * Container style for the banner ad wrapper.
   */
  containerStyle?: object;
  /**
   * Whether to automatically reload on iOS when app comes to foreground.
   * Defaults to true.
   */
  reloadOnForeground?: boolean;
}

/**
 * Common Banner Ad Component
 *
 * A reusable banner ad component that follows Google Mobile Ads best practices.
 * Automatically handles iOS foreground reload and provides all standard event handlers.
 *
 * @example
 * ```tsx
 * <BannerAd
 *   unitId="ca-app-pub-xxx/yyy"
 *   size="ANCHORED_ADAPTIVE_BANNER"
 *   onAdLoaded={() => console.log('Ad loaded')}
 * />
 * ```
 */
export function BannerAd({
  unitId,
  size = 'ANCHORED_ADAPTIVE_BANNER',
  requestOptions,
  onAdClosed,
  onAdFailedToLoad,
  onAdOpened,
  onAdImpression,
  onAdClicked,
  onPaid,
  containerStyle,
  reloadOnForeground = true,
}: BannerAdProps) {
  const bannerRef = useRef<GoogleBannerAd>(null);

  // (iOS) WKWebView can terminate if app is in a "suspended state", resulting in an empty banner when app returns to foreground.
  // Therefore it's advised to "manually" request a new ad when the app is foregrounded.
  useForeground(() => {
    if (reloadOnForeground && Platform.OS === 'ios') {
      bannerRef.current?.load();
    }
  });

  if (!unitId) {
    console.warn('[BannerAd] No ad unit ID provided');
    return null;
  }

  // Convert string size to BannerAdSize enum value
  const bannerSize = size && BannerAdSize[size as keyof typeof BannerAdSize] 
    ? BannerAdSize[size as keyof typeof BannerAdSize] 
    : BannerAdSize.ANCHORED_ADAPTIVE_BANNER;

  return (
    <View style={[styles.container, containerStyle]}>
      <GoogleBannerAd
        ref={bannerRef}
        unitId={unitId}
        size={bannerSize}
        requestOptions={requestOptions}
        onAdClosed={onAdClosed}
        onAdFailedToLoad={onAdFailedToLoad}
        onAdOpened={onAdOpened}
        onAdImpression={onAdImpression}
        onAdClicked={onAdClicked}
        onPaid={onPaid}
      />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
}));

