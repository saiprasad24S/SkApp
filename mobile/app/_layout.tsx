import { useEffect, useState, useRef } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { ClerkProvider, useAuth } from '@clerk/clerk-expo';
import * as SecureStore from 'expo-secure-store';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PaperProvider, ActivityIndicator, Text } from 'react-native-paper';
import { View, StyleSheet, StatusBar, Image } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useAuthStore } from '../src/store/authStore';
import { loginToBackend } from '../src/lib/auth';
import { theme } from '../src/theme';
import ErrorBoundary from '../src/components/ErrorBoundary';
import NetworkBanner from '../src/components/NetworkBanner';
import { registerForPushNotificationsAsync, setupPushTokenListener } from '../src/lib/notifications';

// Ensure splash does not auto-hide until explicitly handled, catching any early native errors
SplashScreen.preventAutoHideAsync().catch((err) => {
  console.warn('[Startup] SplashScreen.preventAutoHideAsync non-fatal error:', err);
});

let isSplashDismissed = false;
async function safeHideSplash(reason: string) {
  if (isSplashDismissed) return;
  isSplashDismissed = true;
  console.log(`[Startup] Hiding splash screen (reason: ${reason})`);
  try {
    await SplashScreen.hideAsync();
    console.log('[Startup] Splash screen hidden successfully');
  } catch (err) {
    console.warn('[Startup] SplashScreen.hideAsync non-fatal error:', err);
  }
}

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
        console.log(`[Startup] ${key} was retrieved from SecureStore`);
      } else {
        console.log(`[Startup] No values stored under key: ${key}`);
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
  const segments = useSegments();
  const router = useRouter();
  const [isInitializing, setIsInitializing] = useState(true);
  const setAuth = useAuthStore((state) => state.setAuth);
  const clear = useAuthStore((state) => state.clear);
  const initStartedRef = useRef(false);

  // Safety fallback: guaranteed splash dismissal within 3500ms under ANY circumstance
  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      console.warn('[Startup] Safety fallback timer triggered (3500ms). Forcing splash dismissal.');
      setIsInitializing(false);
      safeHideSplash('safety-timer-fallback');
    }, 3500);

    return () => clearTimeout(safetyTimer);
  }, []);

  // Handle Clerk timeout: if Clerk takes > 2500ms to resolve isLoaded, fail gracefully to sign-in
  useEffect(() => {
    if (isLoaded) return;

    const clerkTimeout = setTimeout(() => {
      if (!isLoaded) {
        console.warn('[Startup] Clerk isLoaded timed out (2500ms). Proceeding to sign-in.');
        setIsInitializing(false);
        safeHideSplash('clerk-timeout');
        clear();
        router.replace('/(auth)/sign-in');
      }
    }, 2500);

    return () => clearTimeout(clerkTimeout);
  }, [isLoaded]);

  // Main authentication initialization
  useEffect(() => {
    if (!isLoaded) return;
    if (initStartedRef.current) return;
    initStartedRef.current = true;

    console.log(`[Startup] Auth state resolved: isSignedIn=${isSignedIn}`);
    const inAuthGroup = segments[0] === '(auth)';

    const initAuth = async () => {
      try {
        if (isSignedIn) {
          console.log('[Startup] Obtaining Clerk session token...');
          const tokenTimeout = new Promise<null>((resolve) =>
            setTimeout(() => {
              console.warn('[Startup] getToken timed out after 3000ms');
              resolve(null);
            }, 3000)
          );
          const token = await Promise.race([getToken(), tokenTimeout]);

          if (token) {
            console.log('[Startup] Authenticating with Django backend...');
            try {
              // Bounded timeout so off-LAN or slow backend NEVER freezes app startup
              const backendPromise = loginToBackend(token);
              const backendTimeout = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Backend login timed out (3500ms)')), 3500)
              );
              const response = await Promise.race([backendPromise, backendTimeout]);
              console.log('[Startup] Backend login successful. Employee ID:', response.employee?.id);
              setAuth(response);

              // Non-blocking push notification registration in background
              registerForPushNotificationsAsync(token, response.employee?.id).catch((pushErr) => {
                console.warn('[Startup] Non-critical push token registration skipped:', pushErr?.message || pushErr);
              });
            } catch (backendErr: any) {
              console.warn('[Startup] Backend verification skipped/failed:', backendErr?.message || backendErr);
              console.log('[Startup] Continuing with session despite backend ping failure');
            }

            if (inAuthGroup || (segments as string[]).length === 0) {
              console.log('[Startup] Navigating to /(employee)/home');
              router.replace('/(employee)/home');
            }
          } else {
            console.log('[Startup] No valid token found, navigating to sign-in');
            clear();
            router.replace('/(auth)/sign-in');
          }
        } else {
          console.log('[Startup] User not signed in, navigating to sign-in');
          clear();
          if (!inAuthGroup) {
            router.replace('/(auth)/sign-in');
          }
        }
      } catch (err: any) {
        console.error('[Startup] Critical auth initialization error:', err);
        clear();
        if (!inAuthGroup) {
          router.replace('/(auth)/sign-in');
        }
      } finally {
        console.log('[Startup] App ready, completing initialization');
        setIsInitializing(false);
        safeHideSplash('init-complete');
      }
    };

    initAuth();
  }, [isLoaded, isSignedIn]);

  // Push token rotation listener while employee session is active
  useEffect(() => {
    if (!isSignedIn) return;

    const sub = setupPushTokenListener(getToken, () => useAuthStore.getState().profile?.id);
    return () => {
      sub.remove();
    };
  }, [isSignedIn, getToken]);

  if (isInitializing || !isLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <Image
          source={require('../assets/splash-icon.png')}
          style={styles.loadingLogo}
          resizeMode="contain"
        />
        <ActivityIndicator size="small" color="#6B2FA0" style={styles.loadingIndicator} />
        <Text style={styles.loadingText}>SkandanHomecarre</Text>
      </View>
    );
  }

  return <Slot />;
}

export default function RootLayout() {
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

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingLogo: {
    width: 240,
    height: 240,
  },
  loadingIndicator: {
    marginTop: 20,
  },
  loadingText: {
    marginTop: 12,
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
