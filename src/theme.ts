export const colors = {
  bg: '#F4F6FB',
  card: '#FFFFFF',
  text: '#12161F',
  muted: '#6B7385',
  border: '#E2E6F0',
  accent: '#2F6FED',
  overdue: '#D93A3A',
  soon: '#D98A00',
  ok: '#2E9B5B',
};

export const statusColor = {
  overdue: colors.overdue,
  soon: colors.soon,
  ok: colors.ok,
} as const;

export const statusLabel = {
  overdue: 'Overdue',
  soon: 'Due soon',
  ok: 'Scheduled',
} as const;
