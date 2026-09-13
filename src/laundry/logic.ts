/**
 * Formatting and the live countdown only — the wash counters, descale watermark
 * and reminder slots are computed by the server (see ../house-maintainance-be).
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * When to nag about clothes still hanging out.
 *
 * The server's `reminderTimes` are anchored to the due time — due + 6h, +12h, and
 * so on, eight deep — so once two days have passed they are all in the past and
 * the list comes back empty. Left at that, a timer ignored for two days would go
 * quiet exactly when it most needs chasing. So the tail is extended from the last
 * known slot (or `nextReminderAt`, for a timer that came due while the app was
 * closed) until there is a full set ahead again, topped up on every visit.
 */
export function nagTimes(
  dry: { reminderTimes: string[]; nextReminderAt: string },
  repeatHours: number,
  repeatCount: number,
): Date[] {
  const step = repeatHours * 60 * 60 * 1000;
  const times = dry.reminderTimes.map((iso) => new Date(iso));
  if (times.length === 0) times.push(new Date(dry.nextReminderAt));

  while (times.length <= repeatCount) {
    times.push(new Date(times[times.length - 1].getTime() + step));
  }
  return times;
}

export function isOverdue(dueAt: string, now: number = Date.now()): boolean {
  return new Date(dueAt).getTime() <= now;
}

/** "in 1d 4h" / "in 3h 20m" / "5m ago" — short enough for a row. */
export function describeRemaining(dueAt: string, now: number = Date.now()): string {
  const diff = new Date(dueAt).getTime() - now;
  const past = diff < 0;
  const total = Math.abs(diff);

  const days = Math.floor(total / DAY_MS);
  const hours = Math.floor((total % DAY_MS) / (60 * 60 * 1000));
  const minutes = Math.floor((total % (60 * 60 * 1000)) / (60 * 1000));

  let text: string;
  if (days > 0) text = `${days}d ${hours}h`;
  else if (hours > 0) text = `${hours}h ${minutes}m`;
  else text = `${minutes}m`;

  return past ? `${text} ago` : `in ${text}`;
}

/** "Fri 9:30 pm" — when it actually fires, spelled out. */
export function describeDueAt(dueAt: string): string {
  return new Date(dueAt).toLocaleString(undefined, {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function describeDelay(days: number): string {
  if (days < 1) return `${days * 24} hours`;
  if (days === 1) return '1 day';
  return `${days} days`;
}

/** "12 Sep, 8:30 pm" — for the recent-wash list. */
export function describeWash(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}
