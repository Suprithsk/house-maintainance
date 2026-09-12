import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Notification ids stay on the device: expo-notifications issues them per install,
 * so they mean nothing to the server and one phone could not cancel another's
 * alarms. The server owns *when*; this remembers what this phone scheduled.
 */
const KEY = 'sks-home/notification-ids/v1';

export type ScheduledIds = {
  dry: string[];
  descale: string[];
  milk: string[];
  /** What the milk alarms were built from; unchanged means no need to rebuild. */
  milkKey: string;
};

const EMPTY: ScheduledIds = { dry: [], descale: [], milk: [], milkKey: '' };

export async function loadScheduled(): Promise<ScheduledIds> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw);
    return {
      dry: Array.isArray(parsed?.dry) ? parsed.dry : [],
      descale: Array.isArray(parsed?.descale) ? parsed.descale : [],
      milk: Array.isArray(parsed?.milk) ? parsed.milk : [],
      milkKey: typeof parsed?.milkKey === 'string' ? parsed.milkKey : '',
    };
  } catch (error) {
    console.warn('Could not read scheduled ids', error);
    return EMPTY;
  }
}

/** Merge one feature's ids without disturbing the others. */
export async function updateScheduled(patch: Partial<ScheduledIds>): Promise<void> {
  const current = await loadScheduled();
  await saveScheduled({ ...current, ...patch });
}

export async function saveScheduled(ids: ScheduledIds): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(ids));
  } catch (error) {
    console.warn('Could not save scheduled ids', error);
  }
}
