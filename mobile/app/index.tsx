import React, { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { View, ActivityIndicator, StyleSheet, Image } from 'react-native';
import { useAuthStore } from '../src/store/authStore';

export default function IndexScreen() {
  const { isLoaded, isSignedIn } = useAuth();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    console.log(`[Startup] IndexScreen mounted: isLoaded=${isLoaded}, isSignedIn=${isSignedIn}`);
    const timer = setTimeout(() => {
      if (!isLoaded) {
        console.warn('[Startup] Clerk isLoaded timed out in IndexScreen, defaulting to sign-in');
        setTimedOut(true);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [isLoaded, isSignedIn]);

  if (!isLoaded && !timedOut) {
    return (
      <View style={styles.container}>
        <Image
          source={require('../assets/splash-icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <ActivityIndicator size="small" color="#6B2FA0" style={styles.spinner} />
      </View>
    );
  }

  if (isSignedIn) {
    console.log('[Startup] IndexScreen redirecting to /(employee)/home');
    return <Redirect href="/(employee)/home" />;
  }

  console.log('[Startup] IndexScreen redirecting to /(auth)/sign-in');
  return <Redirect href="/(auth)/sign-in" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  logo: {
    width: 220,
    height: 220,
  },
  spinner: {
    marginTop: 20,
  },
});
