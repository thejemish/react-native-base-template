import { useUnistyles } from 'react-native-unistyles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { AdsProvider } from '@/components/ads/AdsProvider';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 60 * 1000, // 1 hour
      gcTime: 60 * 60 * 1000, // 1 hour (formerly cacheTime)
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
    },
  },
});

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function Layout() {
  const { theme } = useUnistyles();

  return (
    <QueryClientProvider client={queryClient}>
      <AdsProvider>
        <Stack
          screenOptions={{
            headerShown: false,
          }}
        />
      </AdsProvider>
    </QueryClientProvider>
  );
}
