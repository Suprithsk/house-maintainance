/** Formatting only — the list rules (merge, sort, revive) live on the server. */

/** "Bought today" / "Bought 12 Sep" — enough context without a full timestamp. */
export function describeBought(iso: string | null): string {
  if (!iso) return '';
  const when = new Date(iso);
  const isToday = new Date().toDateString() === when.toDateString();
  if (isToday) return 'Bought today';
  return `Bought ${when.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
}
