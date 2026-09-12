import { toISODate } from '../dates';

/**
 * When the milkman has been and gone — the moments it's worth asking whether
 * today's delivery was written down.
 */
export const REMINDER_SLOTS: [hour: number, minute: number][] = [
  [9, 30],
  [20, 30],
];

/**
 * Two months of nudges are scheduled up front. Cancelling a repeating daily
 * trigger would cancel every future occurrence, not just today's, and nothing
 * runs in the background to re-arm it — so each slot is its own one-shot and the
 * set is rebuilt whenever the screen opens, which skipping a recorded day needs.
 * 60 days x 3 slots = 180 alarms, comfortably inside Android's per-app ceiling.
 */
const DAYS_AHEAD = 60;

/** The slots still worth firing: future ones, on days with nothing recorded yet. */
export function reminderSlots(recordedDates: Set<string>, now: Date = new Date()): Date[] {
  const slots: Date[] = [];

  for (let day = 0; day < DAYS_AHEAD; day += 1) {
    const date = new Date(now);
    date.setDate(date.getDate() + day);
    const iso = toISODate(date);
    if (recordedDates.has(iso)) continue;

    for (const [hour, minute] of REMINDER_SLOTS) {
      const at = new Date(date);
      at.setHours(hour, minute, 0, 0);
      if (at.getTime() > now.getTime()) slots.push(at);
    }
  }

  return slots;
}

/**
 * What the scheduled set depends on: the slot times, the day it was built on, and
 * which days from today onwards are already recorded. Same signature, same alarms,
 * so the rebuild is skipped unless one of those actually changed. The slot times
 * are in there so editing REMINDER_SLOTS doesn't leave yesterday's alarms standing.
 */
export function slotsSignature(recordedDates: Set<string>, now: Date = new Date()): string {
  const todayISO = toISODate(now);
  const ahead = [...recordedDates].filter((iso) => iso >= todayISO).sort();
  const slots = REMINDER_SLOTS.map(([hour, minute]) => `${hour}:${minute}`).join('+');
  return `${slots}|${todayISO}|${ahead.join(',')}`;
}

/** "9:30 am, 5:30 pm and 8:30 pm" — for the line on the screen. */
export function describeSlots(): string {
  const labels = REMINDER_SLOTS.map(([hour, minute]) => {
    const at = new Date();
    at.setHours(hour, minute, 0, 0);
    return at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  });
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}
