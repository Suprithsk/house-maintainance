import { isRunningInExpoGo } from 'expo';

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
