import React, { useEffect } from 'react';
import { Slot } from 'expo-router';
import { ClerkProvider, useAuth } from '@clerk/clerk-expo';
import * as SecureStore from 'expo-secure-store';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PaperProvider } from 'react-native-paper';
import { StatusBar } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useAuthStore } from '../src/store/authStore';
import { loginToBackend } from '../src/lib/auth';
import { theme } from '../src/theme';
import ErrorBoundary from '../src/components/ErrorBoundary';
import NetworkBanner from '../src/components/NetworkBanner';
import { registerForPushNotificationsAsync, setupPushTokenListener } from '../src/lib/notifications';

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
    try {
      return SecureStore.setItemAsync(key, value);
    } catch (err) {
      return;
    }
  },
};

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY || 'pk_test_bm9ibGUtdmVydmV0LTYyLmNsZXJrLmFjY291bnRzLmRldiQ';

function InitialLayout() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const setAuth = useAuthStore((state) => state.setAuth);

  useEffect(() => {
    console.log(`[Startup] InitialLayout mounted: isLoaded=${isLoaded}, isSignedIn=${isSignedIn}`);
  }, [isLoaded, isSignedIn]);

  // Non-blocking background session sync with Django backend
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    let isMounted = true;

    const syncSession = async () => {
      try {
        console.log('[Startup] Syncing employee session with backend in background...');
        const tokenTimeout = new Promise<null>((resolve) =>
          setTimeout(() => resolve(null), 3000)
        );
        const token = await Promise.race([getToken(), tokenTimeout]);
        if (!token || !isMounted) return;

        const backendPromise = loginToBackend(token);
        const backendTimeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Backend ping timeout (3500ms)')), 3500)
        );
        const response = await Promise.race([backendPromise, backendTimeout]);
        if (isMounted) {
          console.log('[Startup] Background backend sync success, employee ID:', response.employee?.id);
          setAuth(response);

          // Non-blocking push token registration
          registerForPushNotificationsAsync(token, response.employee?.id).catch(() => {});
        }
      } catch (err: any) {
        console.warn('[Startup] Background backend sync skipped (offline/off-LAN):', err?.message || err);
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
