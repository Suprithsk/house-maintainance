/**
 * When the milkman has been and gone. The server decides when to push; this is
 * the same pair of times, kept here only to describe them on screen.
 * Change them in the backend's reminder logic, not here.
 */
export const REMINDER_SLOTS: [hour: number, minute: number][] = [
  [9, 30],
  [20, 30],
];

/** "9:30 am, 5:30 pm and 8:30 pm" — for the line on the screen. */
export function describeSlots(): string {
  const labels = REMINDER_SLOTS.map(([hour, minute]) => {
    const at = new Date();
    at.setHours(hour, minute, 0, 0);
    return at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  });
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}
