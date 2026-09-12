/** Response shapes, mirroring the backend's services in ../house-maintainance-be. */

export type Rates = { milk: number; curd: number };

export type MilkEntry = { date: string; milk: number; curd: number };

export type PricedEntry = MilkEntry & { amount: number };

export type MonthTotals = {
  milkQty: number;
  milkPackets: number;
  curdQty: number;
  curdPackets: number;
  milkAmount: number;
  curdAmount: number;
  total: number;
  days: number;
};

export type MilkSummary = {
  month: string;
  rates: Rates;
  totals: MonthTotals;
  missedDays: string[];
  entries: PricedEntry[];
};

export type ShoppingItem = {
  id: string;
  name: string;
  quantity: number;
  status: 'pending' | 'bought';
  addedAt: string;
  boughtAt: string | null;
};

export type ShoppingList = { pending: ShoppingItem[]; bought: ShoppingItem[] };

export type LaundryState = {
  dry: {
    startedAt: string;
    dueAt: string;
    delayDays: number;
    overdue: boolean;
    /** Due alert plus the nags still ahead — the device schedules these itself. */
    reminderTimes: string[];
    nextReminderAt: string;
  } | null;
  washes: {
    sinceDescale: number;
    thisMonth: number;
    total: number;
    recent: { id: string; washedAt: string }[];
  };
  descale: {
    lastDescaleAt: string | null;
    needed: boolean;
    limit: number;
    remaining: number;
  };
  settings: {
    washLimit: number;
    dryDelayPresets: number[];
    defaultDryDelay: number;
    repeatHours: number;
    repeatCount: number;
  };
};
