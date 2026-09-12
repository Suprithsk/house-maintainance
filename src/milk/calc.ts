import { fromISODate } from '../dates';
import { PACKET_SIZE } from './types';

/** yyyy-mm, the key we group a month's entries by. */
export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}`;
}

export function currentMonth(): string {
  return monthKey(new Date());
}

export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number);
  return monthKey(new Date(y, m - 1 + delta, 1));
}

/** Litres -> packets. Both products are priced per packet. */
export function packetsFor(quantity: number): number {
  return quantity / PACKET_SIZE;
}

/** "12 Sep" — compact enough for a chip. */
export function shortDate(iso: string): string {
  return fromISODate(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function formatQty(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0$/, '');
}

export function formatMoney(value: number): string {
  return `₹${value.toFixed(2)}`;
}
