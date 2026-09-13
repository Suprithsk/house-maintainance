import { request } from './client';
import type { LaundryState, MilkSummary, Rates, ShoppingItem, ShoppingList } from './types';

export const milkApi = {
  summary: (month?: string) =>
    request<MilkSummary>(`/api/milk/summary${month ? `?month=${month}` : ''}`),
  saveEntry: (date: string, quantities: { milk: number; curd: number }) =>
    request(`/api/milk/entries/${date}`, { method: 'PUT', body: quantities }),
  deleteEntry: (date: string) => request(`/api/milk/entries/${date}`, { method: 'DELETE' }),
  setRates: (rates: Rates) => request<Rates>('/api/milk/rates', { method: 'PUT', body: rates }),
};

export const shoppingApi = {
  list: () => request<ShoppingList>('/api/shopping/items'),
  add: (name: string, quantity: number) =>
    request<ShoppingItem>('/api/shopping/items', { method: 'POST', body: { name, quantity } }),
  setQuantity: (id: string, quantity: number) =>
    request<ShoppingItem>(`/api/shopping/items/${id}`, { method: 'PATCH', body: { quantity } }),
  markBought: (id: string) =>
    request<ShoppingItem>(`/api/shopping/items/${id}/bought`, { method: 'POST' }),
  /** "Add again" from the bought pile: quantity intact, addedAt refreshed. */
  markPending: (id: string) =>
    request<ShoppingItem>(`/api/shopping/items/${id}/pending`, { method: 'POST' }),
  remove: (id: string) => request(`/api/shopping/items/${id}`, { method: 'DELETE' }),
};

/** Every laundry write answers with the whole new state, so nothing needs a refetch. */
export const laundryApi = {
  get: () => request<LaundryState>('/api/laundry'),
  startDry: (delayDays: number, label?: string) =>
    request<LaundryState>('/api/laundry/dry', {
      method: 'POST',
      body: label ? { delayDays, label } : { delayDays },
    }),
  /** Brought one load in. */
  clearDry: (id: string) =>
    request<LaundryState>(`/api/laundry/dry/${id}`, { method: 'DELETE' }),
  clearAllDry: () => request<LaundryState>('/api/laundry/dry', { method: 'DELETE' }),
  logWash: () => request<LaundryState>('/api/laundry/washes', { method: 'POST', body: {} }),
  descaled: () => request<LaundryState>('/api/laundry/descale', { method: 'POST', body: {} }),
};
