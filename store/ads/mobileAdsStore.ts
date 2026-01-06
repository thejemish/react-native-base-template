import { create } from 'zustand';
import mobileAds, {
  MaxAdContentRating,
  RequestConfiguration,
  type AdapterStatus,
  AdsConsent,
  type AdsConsentInfo,
  type AdsConsentInfoOptions,
  type AdsConsentUserChoices,
  AdsConsentStatus,
  AdsConsentDebugGeography,
} from 'react-native-google-mobile-ads';

interface MobileAdsState {
  // Initialization state
  isInitialized: boolean;
  isInitializing: boolean;
  adapterStatuses: AdapterStatus[] | null;
  error: Error | null;

  // Consent state
  consentInfo: AdsConsentInfo | null;
  isGatheringConsent: boolean;
  consentError: Error | null;
  userChoices: AdsConsentUserChoices | null;

  // Methods
  initialize: (options?: InitializeOptions) => Promise<void>;
  setRequestConfiguration: (config: RequestConfiguration) => Promise<void>;
  gatherConsent: (options?: AdsConsentInfoOptions) => Promise<AdsConsentInfo>;
  requestConsentInfo: (options?: AdsConsentInfoOptions) => Promise<AdsConsentInfo>;
  getUserChoices: () => Promise<AdsConsentUserChoices>;
  getConsentInfo: () => Promise<AdsConsentInfo>;
  resetConsent: () => void;
  showPrivacyOptionsForm: () => Promise<AdsConsentInfo>;
}

interface InitializeOptions {
  requestConfiguration?: RequestConfiguration;
  consentOptions?: AdsConsentInfoOptions;
  skipConsent?: boolean;
}

export const useMobileAdsStore = create<MobileAdsState>((set, get) => ({
  isInitialized: false,
  isInitializing: false,
  adapterStatuses: null,
  error: null,

  // Consent state
  consentInfo: null,
  isGatheringConsent: false,
  consentError: null,
  userChoices: null,

  /**
   * Set request configuration before initializing the SDK.
   * This should be called before initialize() if you need custom ad settings.
   */
  setRequestConfiguration: async (config: RequestConfiguration) => {
    try {
      await mobileAds().setRequestConfiguration(config);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      set({ error: err });
      throw err;
    }
  },

  /**
   * Request consent information update.
   * This should be called at app launch to determine if consent is required.
   */
  requestConsentInfo: async (options?: AdsConsentInfoOptions) => {
    try {
      const consentInfo = await AdsConsent.requestInfoUpdate(options);
      set({ consentInfo, consentError: null });
      return consentInfo;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      set({ consentError: err });
      throw err;
    }
  },

  /**
   * Gather user consent by requesting info and showing form if required.
   * This is a helper method that combines requestInfoUpdate and loadAndShowConsentFormIfRequired.
   */
  gatherConsent: async (options?: AdsConsentInfoOptions) => {
    set({ isGatheringConsent: true, consentError: null });

    try {
      const consentInfo = await AdsConsent.gatherConsent(options);
      set({
        consentInfo,
        isGatheringConsent: false,
        consentError: null,
      });
      return consentInfo;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      set({
        isGatheringConsent: false,
        consentError: err,
      });
      throw err;
    }
  },

  /**
   * Get the current consent information.
   */
  getConsentInfo: async () => {
    try {
      const consentInfo = await AdsConsent.getConsentInfo();
      set({ consentInfo, consentError: null });
      return consentInfo;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      set({ consentError: err });
      throw err;
    }
  },

  /**
   * Get detailed user consent choices.
   */
  getUserChoices: async () => {
    try {
      const userChoices = await AdsConsent.getUserChoices();
      set({ userChoices, consentError: null });
      return userChoices;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      set({ consentError: err });
      throw err;
    }
  },

  /**
   * Show privacy options form (for users to change their consent choices).
   */
  showPrivacyOptionsForm: async () => {
    try {
      const consentInfo = await AdsConsent.showPrivacyOptionsForm();
      set({ consentInfo, consentError: null });
      return consentInfo;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      set({ consentError: err });
      throw err;
    }
  },

  /**
   * Reset consent state (useful for testing).
   */
  resetConsent: () => {
    AdsConsent.reset();
    set({
      consentInfo: null,
      userChoices: null,
      consentError: null,
    });
  },

  /**
   * Initialize the Google Mobile Ads SDK with optional consent gathering.
   * This follows the recommended flow from the documentation:
   * 1. Gather consent (if not skipped)
   * 2. Check if ads can be requested
   * 3. Initialize the SDK
   *
   * @param options Configuration options including request configuration and consent options
   */
  initialize: async (options?: InitializeOptions) => {
    // Prevent multiple initializations
    if (get().isInitialized || get().isInitializing) {
      return;
    }

    set({ isInitializing: true, error: null });

    try {
      const { requestConfiguration, consentOptions, skipConsent = false } = options || {};

      // Step 1: Gather consent if not skipped
      if (!skipConsent) {
        try {
          await get().gatherConsent(consentOptions);
        } catch (consentError) {
          // Even if consent gathering fails, we should still attempt to initialize
          // The UMP SDK uses the consent status from the previous session
          console.warn('Consent gathering failed, continuing with initialization:', consentError);
        }
      }

      // Step 2: Check if we can request ads
      const consentInfo = await get().getConsentInfo();
      const canRequestAds = consentInfo?.canRequestAds ?? false;

      if (!canRequestAds && !skipConsent) {
        console.warn('Cannot request ads yet. Consent may still be required or processing.');
        // Continue anyway - the SDK will handle non-personalized ads if needed
      }

      // Step 3: Set request configuration if provided
      if (requestConfiguration) {
        await mobileAds().setRequestConfiguration(requestConfiguration);
      }

      // Step 4: Initialize the SDK
      const adapterStatuses = await mobileAds().initialize();

      set({
        isInitialized: true,
        isInitializing: false,
        adapterStatuses,
        error: null,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      set({
        isInitialized: false,
        isInitializing: false,
        error: err,
      });
      throw err;
    }
  },
}));

export const useInitialize = () => useMobileAdsStore((state) => state.initialize);
export const useRequestConsentInfo = () => useMobileAdsStore((state) => state.requestConsentInfo);
export const useGatherConsent = () => useMobileAdsStore((state) => state.gatherConsent);
export const useGetConsentInfo = () => useMobileAdsStore((state) => state.getConsentInfo);
export const useGetUserChoices = () => useMobileAdsStore((state) => state.getUserChoices);
export const useShowPrivacyOptionsForm = () => useMobileAdsStore((state) => state.showPrivacyOptionsForm);
export const useResetConsent = () => useMobileAdsStore((state) => state.resetConsent);
export const useIsInitialized = () => useMobileAdsStore((state) => state.isInitialized);
export const useIsInitializing = () => useMobileAdsStore((state) => state.isInitializing);
export const useIsGatheringConsent = () => useMobileAdsStore((state) => state.isGatheringConsent);
export const useError = () => useMobileAdsStore((state) => state.error);
export const useConsentInfo = () => useMobileAdsStore((state) => state.consentInfo);
export const useUserChoices = () => useMobileAdsStore((state) => state.userChoices);
export const useConsentError = () => useMobileAdsStore((state) => state.consentError);
export const useAdapterStatuses = () => useMobileAdsStore((state) => state.adapterStatuses);

// Export types and enums for convenience
export { MaxAdContentRating, AdsConsentStatus, AdsConsentDebugGeography };
export type { RequestConfiguration, AdsConsentInfo, AdsConsentInfoOptions, AdsConsentUserChoices };
