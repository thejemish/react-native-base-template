import { useEffect, useState } from 'react';
import { View, Text, Image } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import {
  NativeAdView,
  NativeAsset,
  NativeAssetType,
  NativeMediaView,
  type NativeAd,
} from 'react-native-google-mobile-ads';
import { useNativeAdsPoolStore } from '@/store/ads/nativeAdsPoolStore';
import { areAdsEnabled } from '@/services/adConfigService';

interface MediumNativeAdProps {
  screenName: string;
  position: number; // Position in the list where this ad should appear
  style?: object;
}

/**
 * Managed Native Ad View Component
 * 
 * Position-based native ad component that:
 * - Gets ad for a specific position (viewport-based loading)
 * - Shows skeleton shimmer while ad is loading
 * - Renders the ad using NativeAdView
 * - Returns null if ads are disabled for the screen
 * 
 * @example
 * ```tsx
 * <ManagedNativeAdView screenName="home" position={1} />
 * ```
 */
export function MediumNativeAd({ screenName, position, style }: MediumNativeAdProps) {
  const [adsEnabled, setAdsEnabled] = useState<boolean | null>(null);
  const ad = useNativeAdsPoolStore((state) => state.getAdForPosition(screenName, position));

  // Check if ads are enabled for this screen
  useEffect(() => {
    areAdsEnabled(screenName)
      .then((enabled) => {
        setAdsEnabled(enabled);
      })
      .catch((error) => {
        console.error(`[ManagedNativeAdView] Error checking if ads are enabled for ${screenName}:`, error);
        // Default to disabled on error
        setAdsEnabled(false);
      });
  }, [screenName]);

  // Return null if ads are disabled
  if (adsEnabled === false) {
    return null;
  }

  // PRIORITY 1: If we have an ad, ALWAYS show it (prevents flickering)
  if (ad) {
    return <NativeAdContent nativeAd={ad.nativeAd} style={style} />;
  }

  // PRIORITY 2: Show skeleton while:
  // - Checking if ads are enabled (adsEnabled === null)
  // - No ad available yet
  return <SkeletonShimmer style={style} />;
}

/**
 * Skeleton shimmer component shown while ads are loading
 */
function SkeletonShimmer({ style }: { style?: object }) {
  return (
    <View style={[styles.container, styles.skeletonContainer, style]}>
      <View style={styles.skeletonContent}>
        {/* Header skeleton */}
        <View style={styles.skeletonHeader}>
          <View style={styles.skeletonIcon} />
          <View style={styles.skeletonHeaderText}>
            <View style={styles.skeletonLine} />
            <View style={[styles.skeletonLine, styles.skeletonLineShort]} />
          </View>
        </View>

        {/* Media skeleton */}
        <View style={styles.skeletonMedia} />

        {/* Footer skeleton */}
        <View style={styles.skeletonFooter}>
          <View style={[styles.skeletonLine, styles.skeletonLineMedium]} />
          <View style={styles.skeletonCta} />
        </View>
      </View>
    </View>
  );
}

/**
 * Native ad content component
 */
function NativeAdContent({ nativeAd, style }: { nativeAd: NativeAd; style?: object }) {
  if (!nativeAd) {
    return <SkeletonShimmer style={style} />;
  }

  return (
    <NativeAdView nativeAd={nativeAd} style={[styles.container, style]}>
      <View style={styles.content}>
        {/* Header with icon and headline */}
        <View style={styles.header}>
          {nativeAd.icon && (
            <NativeAsset assetType={NativeAssetType.ICON}>
              <Image
                source={{ uri: nativeAd.icon.url }}
                style={styles.icon}
                resizeMode="cover"
              />
            </NativeAsset>
          )}
          <View style={styles.headerText}>
            <NativeAsset assetType={NativeAssetType.HEADLINE}>
              <Text style={styles.headline} numberOfLines={2}>
                {nativeAd.headline}
              </Text>
            </NativeAsset>
            {nativeAd.advertiser && (
              <NativeAsset assetType={NativeAssetType.ADVERTISER}>
                <Text style={styles.advertiser} numberOfLines={1}>
                  {nativeAd.advertiser}
                </Text>
              </NativeAsset>
            )}
          </View>
        </View>

        {/* Media view */}
        {nativeAd.mediaContent && (
          <View style={styles.mediaContainer}>
            <NativeMediaView style={styles.media} resizeMode="cover" />
          </View>
        )}

        {/* Body and call to action */}
        <View style={styles.footer}>
          {nativeAd.body && (
            <NativeAsset assetType={NativeAssetType.BODY}>
              <Text style={styles.body} numberOfLines={2}>
                {nativeAd.body}
              </Text>
            </NativeAsset>
          )}
          {nativeAd.callToAction && (
            <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
              <View style={styles.ctaButton}>
                <Text style={styles.ctaText}>{nativeAd.callToAction}</Text>
              </View>
            </NativeAsset>
          )}
        </View>

        {/* Ad attribution */}
        <Text style={styles.sponsored}>Sponsored</Text>
      </View>
    </NativeAdView>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    marginBottom: theme.margins.lg,
    marginHorizontal: theme.margins.md,
  },
  content: {
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    padding: theme.margins.md,
    borderWidth: 1,
    borderColor: theme.colors.typography,
    borderOpacity: 0.1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: theme.margins.md,
    gap: theme.margins.sm,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: theme.colors.typography,
    opacity: 0.1,
  },
  headerText: {
    flex: 1,
    gap: theme.margins.sm,
  },
  headline: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.typography,
    lineHeight: 18,
  },
  advertiser: {
    fontSize: 12,
    color: theme.colors.typography,
    opacity: 0.6,
  },
  mediaContainer: {
    width: '100%',
    marginBottom: theme.margins.md,
    borderRadius: 8,
    overflow: 'hidden',
  },
  media: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: theme.colors.typography,
    opacity: 0.1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.margins.sm,
  },
  body: {
    flex: 1,
    fontSize: 12,
    color: theme.colors.typography,
    opacity: 0.7,
    lineHeight: 16,
  },
  ctaButton: {
    backgroundColor: theme.colors.azureRadiance,
    paddingVertical: theme.margins.sm,
    paddingHorizontal: theme.margins.md,
    borderRadius: 6,
  },
  ctaText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  sponsored: {
    fontSize: 10,
    color: theme.colors.typography,
    opacity: 0.5,
    marginTop: theme.margins.sm,
    textTransform: 'uppercase',
  },
  // Skeleton styles
  skeletonContainer: {
    minHeight: 200,
  },
  skeletonContent: {
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    padding: theme.margins.md,
    borderWidth: 1,
    borderColor: theme.colors.typography,
    borderOpacity: 0.1,
  },
  skeletonHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: theme.margins.md,
    gap: theme.margins.sm,
  },
  skeletonIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: theme.colors.typography,
    opacity: 0.1,
  },
  skeletonHeaderText: {
    flex: 1,
    gap: theme.margins.sm,
  },
  skeletonLine: {
    height: 14,
    backgroundColor: theme.colors.typography,
    opacity: 0.1,
    borderRadius: 4,
    width: '100%',
  },
  skeletonLineShort: {
    width: '60%',
  },
  skeletonLineMedium: {
    width: '70%',
  },
  skeletonMedia: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: theme.colors.typography,
    opacity: 0.1,
    borderRadius: 8,
    marginBottom: theme.margins.md,
  },
  skeletonFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.margins.sm,
  },
  skeletonCta: {
    width: 80,
    height: 32,
    backgroundColor: theme.colors.typography,
    opacity: 0.1,
    borderRadius: 6,
  },
}));

