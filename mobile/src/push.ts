import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { QueryClient } from '@tanstack/react-query';
import * as endpoints from './api/endpoints';
import { FEATURES } from './config/features';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: FEATURES.ENABLE_PUSH_NOTIFICATIONS,
    shouldPlaySound: FEATURES.ENABLE_PUSH_NOTIFICATIONS,
    shouldSetBadge: FEATURES.ENABLE_PUSH_NOTIFICATIONS,
    shouldShowBanner: FEATURES.ENABLE_PUSH_NOTIFICATIONS,
    shouldShowList: FEATURES.ENABLE_PUSH_NOTIFICATIONS,
  }),
});

/**
 * Registers this phone for push. Needs a development build (not Expo Go) with Firebase set up
 * (google-services.json). Android gives an FCM token that the backend can use directly.
 * On iOS the token is an APNs token, which needs extra Firebase setup first (see README), so we skip it for now.
 */
export async function registerForPush(): Promise<void> {
  if (!FEATURES.ENABLE_PUSH_NOTIFICATIONS) {
    // Push notifications are currently disabled via feature flag
    return;
  }
  try {
    if (Platform.OS !== 'android') return;
    await Notifications.setNotificationChannelAsync('default', {
      name: 'TripSplit Notifications',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#D4FF00',
      enableVibrate: true,
      sound: 'default',
    });
    const perm = await Notifications.getPermissionsAsync();
    let status = perm.status;
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return;
    const token = await Notifications.getDevicePushTokenAsync();
    await endpoints.devices.save(String(token.data), 'ANDROID');
  } catch {
    // push is a bonus: never block the app if it is not configured
  }
}

/** Refresh data when a push arrives; open the trip when it is tapped. */
export function listenToPush(qc: QueryClient, openTrip: (tripId: string) => void): () => void {
  if (!FEATURES.ENABLE_PUSH_NOTIFICATIONS) {
    return () => {};
  }
  const received = Notifications.addNotificationReceivedListener(() => { qc.invalidateQueries(); });
  const tapped = Notifications.addNotificationResponseReceivedListener((resp) => {
    qc.invalidateQueries();
    const tripId = resp.notification.request.content.data?.tripId;
    if (typeof tripId === 'string') openTrip(tripId);
  });
  return () => { received.remove(); tapped.remove(); };
}
