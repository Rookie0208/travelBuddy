/**
 * Feature Configuration & Toggle Flags
 *
 * Use this file (or your .env) to enable or disable features across the app.
 */
export const FEATURES = {
  /**
   * Push Notifications (FCM)
   *
   * Set to `true` to enable FCM push notification registration and handlers.
   * Set to `false` to disable the push notification service.
   *
   * Can also be controlled via EXPO_PUBLIC_ENABLE_PUSH_NOTIFICATIONS in .env
   */
  ENABLE_PUSH_NOTIFICATIONS: process.env.EXPO_PUBLIC_ENABLE_PUSH_NOTIFICATIONS !== 'false',
};

