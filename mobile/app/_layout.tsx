import React, { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { ClerkProvider, useAuth } from '@clerk/clerk-expo';
import * as SecureStore from 'expo-secure-store';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PaperProvider } from 'react-native-paper';
import { StatusBar, Platform } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useAuthStore } from '../src/store/authStore';
import { loginToBackend } from '../src/lib/auth';
import { theme } from '../src/theme';
import ErrorBoundary from '../src/components/ErrorBoundary';
import NetworkBanner from '../src/components/NetworkBanner';
import { registerForPushNotificationsAsync, setupPushTokenListener } from '../src/lib/notifications';
import { registerTokenProvider } from '../src/lib/api';

// DO NOT call SplashScreen.preventAutoHideAsync()!
// Allowing standard Expo splash lifecycle ensures native Android automatically
// dismisses the splash screen as soon as the first React Native view is drawn.

console.log('[Startup] JS bundle started');

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30 seconds
      gcTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
    },
  },
});

const tokenCache = {
  async getToken(key: string) {
    if (Platform.OS === 'web') {
      try {
        return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
      } catch {
        return null;
      }
    }
    try {
      const item = await SecureStore.getItemAsync(key);
      if (item) {
        console.log(`[Startup] ${key} retrieved from SecureStore`);
      }
      return item;
    } catch (error) {
      console.error('[Startup] SecureStore get item error: ', error);
      await SecureStore.deleteItemAsync(key).catch(() => {});
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    if (Platform.OS === 'web') {
      try {
        if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
      } catch {}
      return;
    }
    try {
      return SecureStore.setItemAsync(key, value);
    } catch (err) {
      return;
    }
  },
};

const rawClerkKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
const publishableKey =
  rawClerkKey && !rawClerkKey.includes('REPLACE_WITH')
    ? rawClerkKey
    : 'pk_test_bm9ibGUtdmVydmV0LTYyLmNsZXJrLmFjY291bnRzLmRldiQ';

function InitialLayout() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const setAuth = useAuthStore((state) => state.setAuth);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    console.log(`[Startup] InitialLayout mounted: isLoaded=${isLoaded}, isSignedIn=${isSignedIn}`);
  }, [isLoaded, isSignedIn]);

  // Register active token provider for automatic 401/403 retry across all API calls
  useEffect(() => {
    registerTokenProvider(async (skipCache = false) => {
      try {
        return await getToken(skipCache ? ({ skipCache: true } as any) : undefined);
      } catch {
        return null;
      }
    });
    return () => registerTokenProvider(null);
  }, [getToken]);

  // Auth routing: redirect to home if signed in, or to sign-in if not signed in
  useEffect(() => {
    if (!isLoaded) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (isSignedIn && inAuthGroup) {
      console.log('[Auth] User is signed in, redirecting to /(employee)/home');
      router.replace('/(employee)/home');
    } else if (!isSignedIn && !inAuthGroup) {
      console.log('[Auth] User not signed in, redirecting to /(auth)/sign-in');
      router.replace('/(auth)/sign-in');
    }
  }, [isLoaded, isSignedIn, segments]);

  // Resilient background session sync with Django backend
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    let isMounted = true;

    const syncSession = async (attempt = 1) => {
      try {
        console.log(`[Startup] Syncing employee session with backend (attempt ${attempt})...`);
        const tokenTimeout = new Promise<null>((resolve) =>
          setTimeout(() => resolve(null), 8000)
        );
        const token = await Promise.race([getToken(), tokenTimeout]);
        if (!token || !isMounted) return;

        const response = await loginToBackend(token);
        if (isMounted) {
          console.log('[Startup] Backend sync success, employee ID:', response.employee?.id);
          setAuth(response);

          // Non-blocking push token registration
          registerForPushNotificationsAsync(token, response.employee?.id).catch(() => {});
        }
      } catch (err: any) {
        console.warn(`[Startup] Backend sync attempt ${attempt} failed:`, err?.message || err);
        if (isMounted && attempt < 3) {
          // Retry with exponential backoff: 2s, 4s
          setTimeout(() => {
            if (isMounted) syncSession(attempt + 1);
          }, attempt * 2000);
        }
      }
    };

    syncSession();

    return () => {
      isMounted = false;
    };
  }, [isLoaded, isSignedIn]);

  // Push token listener while authenticated
  useEffect(() => {
    if (!isSignedIn) return;
    const sub = setupPushTokenListener(getToken, () => useAuthStore.getState().profile?.id);
    return () => {
      sub.remove();
    };
  }, [isSignedIn, getToken]);

  // ALWAYS return Slot directly so Expo Router mounts the navigation tree immediately!
  return <Slot />;
}

export default function RootLayout() {
  useEffect(() => {
    console.log('[Startup] Root layout mounted');
    console.log('[Startup] Splash hide requested');
    SplashScreen.hideAsync()
      .then(() => console.log('[Startup] Splash hide completed'))
      .catch((err) => console.warn('[Startup] SplashScreen.hideAsync non-fatal:', err));
  }, []);

  return (
    <ErrorBoundary>
      <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
        <QueryClientProvider client={queryClient}>
          <PaperProvider theme={theme as any}>
            <StatusBar barStyle="light-content" backgroundColor="#6B2FA0" />
            <NetworkBanner />
            <InitialLayout />
          </PaperProvider>
        </QueryClientProvider>
      </ClerkProvider>
    </ErrorBoundary>
  );
}
