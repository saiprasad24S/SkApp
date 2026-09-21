import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { registerPushDeviceToken } from '../api/notificationApi';

// Configure foreground notification presentation
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const PUSH_TOKEN_CACHE_KEY = 'skandan_last_registered_push_token';
const PUSH_EMPLOYEE_CACHE_KEY = 'skandan_last_registered_employee_id';

let memoryRegisteredToken: string | null = null;
let memoryRegisteredEmployeeId: string | null = null;

/**
 * Configure Android notification channels.
 * Reuses the 'default' channel configured in app.json and backend push service.
 */
export async function setupNotificationChannel(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Employee Notifications',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#6B2FA0',
      sound: 'default',
    });
  }
}

/**
 * Requests push permissions, retrieves the Expo push token, and registers it with the backend.
 * This operation is non-blocking and will never throw an unhandled exception or crash the app.
 */
export async function registerForPushNotificationsAsync(
  authToken: string,
  employeeId?: string | number
): Promise<string | null> {
  try {
    if (!Device.isDevice) {
      console.log('[Push] Must use a physical device for push notifications');
      return null;
    }

    // 1. Check existing permission status
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // 2. Request permission if not already granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[Push] Push notification permission denied');
      return null;
    }

    console.log('[Push] Push notification permission granted');

    // 3. Ensure Android notification channel is configured
    await setupNotificationChannel();

    // 4. Retrieve Expo push token
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ||
      Constants?.easConfig?.projectId;

    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    const pushToken = tokenResponse.data;

    if (!pushToken) {
      console.log('[Push] Push token registration failed: empty token returned');
      return null;
    }

    console.log('[Push] Push token obtained successfully');

    // 5. Prevent duplicate registration if token and employee haven't changed
    const currentEmpId = employeeId ? String(employeeId) : '';
    if (
      memoryRegisteredToken === pushToken &&
      memoryRegisteredEmployeeId === currentEmpId
    ) {
      return pushToken;
    }

    const cachedToken = await SecureStore.getItemAsync(PUSH_TOKEN_CACHE_KEY);
    const cachedEmpId = await SecureStore.getItemAsync(PUSH_EMPLOYEE_CACHE_KEY);

    if (cachedToken === pushToken && cachedEmpId === currentEmpId) {
      memoryRegisteredToken = pushToken;
      memoryRegisteredEmployeeId = currentEmpId;
      return pushToken;
    }

    // 6. Register token with backend
    await registerPushDeviceToken(pushToken, Platform.OS, authToken);
    console.log('[Push] Push token registered with backend');

    // 7. Update cache
    memoryRegisteredToken = pushToken;
    memoryRegisteredEmployeeId = currentEmpId;
    await SecureStore.setItemAsync(PUSH_TOKEN_CACHE_KEY, pushToken);
    if (currentEmpId) {
      await SecureStore.setItemAsync(PUSH_EMPLOYEE_CACHE_KEY, currentEmpId);
    }

    return pushToken;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.log('[Push] Push token registration failed:', errorMsg);
    return null;
  }
}

/**
 * Listens for push token updates if the device token changes during app runtime,
 * automatically re-registering the updated token with the backend.
 */
export function setupPushTokenListener(
  authTokenGetter: () => Promise<string | null>,
  employeeIdGetter?: () => string | number | undefined | null
) {
  return Notifications.addPushTokenListener(async (tokenData) => {
    try {
      const pushToken = tokenData?.data;
      if (!pushToken) return;

      const authToken = await authTokenGetter();
      if (!authToken) return;

      const empId = employeeIdGetter ? employeeIdGetter() : undefined;
      const currentEmpId = empId ? String(empId) : '';

      if (
        memoryRegisteredToken === pushToken &&
        memoryRegisteredEmployeeId === currentEmpId
      ) {
        return;
      }

      await registerPushDeviceToken(pushToken, Platform.OS, authToken);
      console.log('[Push] Push token updated & re-registered with backend');

      memoryRegisteredToken = pushToken;
      memoryRegisteredEmployeeId = currentEmpId;
      await SecureStore.setItemAsync(PUSH_TOKEN_CACHE_KEY, pushToken);
      if (currentEmpId) {
        await SecureStore.setItemAsync(PUSH_EMPLOYEE_CACHE_KEY, currentEmpId);
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.log('[Push] Push token update registration failed:', errorMsg);
    }
  });
}
