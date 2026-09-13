import AsyncStorage from '@react-native-async-storage/async-storage';
import { isRunningInExpoGo } from 'expo';
import Constants from 'expo-constants';

export const ANDROID_CHANNEL_ID = 'reminders';

type NotificationsModule = typeof import('expo-notifications');

/**
 * expo-notifications must be loaded lazily.
 * Importing it runs DevicePushTokenAutoRegistration.fx at module scope, which calls
 * addPushTokenListener -> warnOfExpoGoPushUsage, and that THROWS on Android inside Expo Go
 * (push was removed in SDK 53). A static import would crash the app on launch even though we
 * only ever schedule local notifications. In Expo Go we skip the module entirely and run
 * without reminders; a dev build gets the real thing.
 */
let modulePromise: Promise<NotificationsModule | null> | null = null;

function loadNotifications(): Promise<NotificationsModule | null> {
  if (isRunningInExpoGo()) return Promise.resolve(null);
  if (!modulePromise) {
    modulePromise = import('expo-notifications')
      .then((Notifications) => {
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
          }),
        });
        return Notifications;
      })
      .catch((error) => {
        console.warn('expo-notifications unavailable', error);
        return null;
      });
  }
  return modulePromise;
}

export function remindersSupported(): boolean {
  return !isRunningInExpoGo();
}

/**
 * This phone's Expo push token, for the server to send to.
 * projectId is required — without it Expo cannot tell which project the token
 * belongs to, and issuing silently fails.
 */
export async function getPushToken(): Promise<string | null> {
  const Notifications = await loadNotifications();
  if (!Notifications) return null;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    console.warn('No EAS projectId in app config; cannot get a push token.');
    return null;
  }

  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch (error) {
    console.warn('Could not get a push token', error);
    return null;
  }
}

const LEGACY_CLEARED_KEY = 'sks-home/legacy-local-schedule-cleared/v1';

/**
 * Earlier builds scheduled every reminder locally — roughly 119 milk alarms plus
 * the drying nags. Those are still sitting in Android's scheduler after an
 * upgrade, and would fire alongside the server's push. Clear them once.
 */
export async function clearLegacyLocalSchedule(): Promise<void> {
  try {
    if (await AsyncStorage.getItem(LEGACY_CLEARED_KEY)) return;
    const Notifications = await loadNotifications();
    if (!Notifications) return;
    await Notifications.cancelAllScheduledNotificationsAsync();
    await AsyncStorage.setItem(LEGACY_CLEARED_KEY, new Date().toISOString());
    console.log('Cleared locally scheduled reminders; the server sends them now.');
  } catch (error) {
    console.warn('Could not clear old local reminders', error);
  }
}

/** Creates the Android channel and asks for POST_NOTIFICATIONS (Android 13+). */
export async function setupNotifications(): Promise<boolean> {
  const Notifications = await loadNotifications();
  if (!Notifications) return false;

  try {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2F6FED',
    });
    const existing = await Notifications.getPermissionsAsync();
    if (existing.granted) return true;
    const asked = await Notifications.requestPermissionsAsync();
    return asked.granted;
  } catch (error) {
    console.warn('Could not set up notifications', error);
    return false;
  }
}

/** What the OS actually holds — the honest answer to "is anything scheduled?". */
export async function scheduledCount(): Promise<number> {
  const Notifications = await loadNotifications();
  if (!Notifications) return 0;
  try {
    return (await Notifications.getAllScheduledNotificationsAsync()).length;
  } catch (error) {
    console.warn('Could not read scheduled notifications', error);
    return 0;
  }
}

export async function cancelReminders(notificationIds: string[]): Promise<void> {
  if (notificationIds.length === 0) return;
  const Notifications = await loadNotifications();
  if (!Notifications) return;

  for (const id of notificationIds) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch (error) {
      console.warn('Could not cancel reminder', error);
    }
  }
}

/**
 * Repeats every day at the given local time until cancelled — used for a nag that
 * should keep arriving indefinitely rather than a fixed number of follow-ups.
 */
export async function scheduleDaily(
  hour: number,
  minute: number,
  title: string,
  body: string,
): Promise<string | null> {
  const Notifications = await loadNotifications();
  if (!Notifications) return null;

  try {
    return await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
        channelId: ANDROID_CHANNEL_ID,
      },
    });
  } catch (error) {
    console.warn('Could not schedule daily reminder', error);
    return null;
  }
}

/**
 * One notification per time in `times`, each to the minute — not a rounded hour.
 * There is no repeating-from-a-date trigger, so a nag series is scheduled as
 * separate one-shot alerts; the caller stores every id so all can be cancelled.
 * Returns the ids that were actually scheduled (empty if unavailable).
 */
export async function scheduleSeries(
  times: Date[],
  title: string,
  bodyFor: (index: number) => string,
): Promise<string[]> {
  const Notifications = await loadNotifications();
  if (!Notifications) return [];

  const ids: string[] = [];
  for (const [index, when] of times.entries()) {
    if (when.getTime() <= Date.now()) continue;
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: { title, body: bodyFor(index) },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: when,
          channelId: ANDROID_CHANNEL_ID,
        },
      });
      ids.push(id);
    } catch (error) {
      console.warn('Could not schedule reminder', error);
    }
  }
  return ids;
}
