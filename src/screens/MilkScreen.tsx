import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { milkApi } from '../api';
import { describeError } from '../api/client';
import type { MilkSummary, PricedEntry, Rates } from '../api/types';
import { ConfirmModal } from '../components/ConfirmModal';
import { loadScheduled, updateScheduled } from '../deviceNotifications';
import { DateField } from '../components/DateField';
import { ErrorBanner } from '../components/ErrorBanner';
import { RatesModal } from '../components/RatesModal';
import { today } from '../dates';
import {
  currentMonth,
  formatMoney,
  formatQty,
  monthLabel,
  packetsFor,
  shiftMonth,
  shortDate,
} from '../milk/calc';
import { describeSlots, reminderSlots, slotsSignature } from '../milk/reminders';
import { DEFAULT_QUANTITY, PACKET_SIZE, QUANTITY_PRESETS } from '../milk/types';
import {
  cancelReminders,
  scheduleSeries,
  scheduledCount,
  setupNotifications,
} from '../notifications';
import { colors } from '../theme';

type Props = { onBack: () => void };

export function MilkScreen({ onBack }: Props) {
  const [summary, setSummary] = useState<MilkSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [month, setMonth] = useState(currentMonth());
  const [ratesOpen, setRatesOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PricedEntry | null>(null);
  const [remindersOn, setRemindersOn] = useState(false);
  const [scheduled, setScheduled] = useState(0);

  // Form state — one entry per date, so picking an existing date edits that day.
  const [date, setDate] = useState(today());
  const [milk, setMilk] = useState(String(DEFAULT_QUANTITY));
  const [curd, setCurd] = useState(String(DEFAULT_QUANTITY));

  const permissionRef = useRef(false);

  /**
   * Rebuild the nudges from what the server says is recorded — but only when that
   * has actually changed. Otherwise every visit would re-issue hundreds of native
   * calls to arrive at the same alarms.
   *
   * Permission is resolved here rather than in a parallel effect: the prompt waits
   * on a human, the data load does not, so anything racing the two skips scheduling
   * entirely on the launch that matters.
   */
  const syncReminders = useCallback(async (recorded: Set<string>) => {
    if (!permissionRef.current) {
      permissionRef.current = await setupNotifications();
      setRemindersOn(permissionRef.current);
    }
    if (!permissionRef.current) return;

    const stored = await loadScheduled();
    const key = slotsSignature(recorded);
    if (stored.milkKey === key && stored.milk.length > 0) {
      setScheduled(await scheduledCount());
      return;
    }

    await cancelReminders(stored.milk);
    const milk = await scheduleSeries(
      reminderSlots(recorded),
      "Log today's milk",
      () => 'Tap to record the milk and curd taken today.',
    );
    await updateScheduled({ milk, milkKey: key });
    setScheduled(await scheduledCount());
  }, []);

  const load = useCallback(
    async (key: string) => {
      try {
        setError(null);
        const next = await milkApi.summary(key);
        setSummary(next);
        // Only the current month can say anything about today onwards.
        if (next.month === currentMonth()) {
          await syncReminders(new Set(next.entries.map((entry) => entry.date)));
        }
      } catch (err) {
        setError(describeError(err));
      }
    },
    [syncReminders],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await load(month);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [month, load]);

  // Fill the form from whatever the server already holds for the chosen date.
  // Keyed on the date and the loaded month only, so it never overwrites typing.
  const prefilled = useRef('');
  useEffect(() => {
    if (!summary || summary.month !== date.slice(0, 7)) return;
    const key = `${summary.month}:${date}:${summary.entries.length}`;
    if (prefilled.current === key) return;
    prefilled.current = key;

    const existing = summary.entries.find((entry) => entry.date === date);
    setMilk(String(existing?.milk ?? DEFAULT_QUANTITY));
    setCurd(String(existing?.curd ?? DEFAULT_QUANTITY));
  }, [summary, date]);

  const milkPackets = packetsFor(Number.parseFloat(milk || '0') || 0);
  const curdPackets = packetsFor(Number.parseFloat(curd || '0') || 0);
  const editingExisting = useMemo(
    () => summary?.entries.some((entry) => entry.date === date) ?? false,
    [summary, date],
  );

  /** Tapping a day — recorded or missed — loads it into the form. */
  const editDate = useCallback((iso: string) => {
    setDate(iso);
    prefilled.current = '';
    setMonth(iso.slice(0, 7));
  }, []);

  const handleSaveEntry = useCallback(async () => {
    const milkQty = Number.parseFloat(milk || '0');
    const curdQty = Number.parseFloat(curd || '0');

    if (!Number.isFinite(milkQty) || milkQty < 0 || !Number.isFinite(curdQty) || curdQty < 0) {
      Alert.alert('Check the quantity', 'Quantities must be zero or more.');
      return;
    }
    // The server rejects anything off the packet step, so catch it before the trip.
    if (milkQty % PACKET_SIZE !== 0 || curdQty % PACKET_SIZE !== 0) {
      Alert.alert('Check the quantity', `Use steps of ${PACKET_SIZE} L — they come in packets.`);
      return;
    }

    setSaving(true);
    try {
      await milkApi.saveEntry(date, { milk: milkQty, curd: curdQty });
      prefilled.current = '';
      await load(date.slice(0, 7));
    } catch (err) {
      setError(describeError(err));
    } finally {
      setSaving(false);
    }
  }, [date, milk, curd, load]);

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);
    try {
      await milkApi.deleteEntry(target.date);
      prefilled.current = '';
      await load(month);
    } catch (err) {
      setError(describeError(err));
    }
  }, [pendingDelete, month, load]);

  const handleSaveRates = useCallback(
    async (next: Rates) => {
      setRatesOpen(false);
      try {
        await milkApi.setRates(next);
        await load(month);
      } catch (err) {
        setError(describeError(err));
      }
    },
    [month, load],
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load(month);
    setRefreshing(false);
  }, [month, load]);

  if (loading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const rates = summary?.rates;
  const totals = summary?.totals;
  const missed = summary?.missedDays ?? [];
  const entries = summary?.entries ?? [];

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [styles.backButton, pressed && styles.backPressed]}
          onPress={onBack}
          hitSlop={12}
          android_ripple={{ color: '#00000012', borderless: false }}>
          <Text style={styles.back}>‹  Home</Text>
        </Pressable>
        <Text style={styles.title}>Milk &amp; Curd</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        {error ? <ErrorBanner message={error} onRetry={refresh} /> : null}

        {/* Rates, always visible on the page itself */}
        <Pressable
          style={styles.ratesRow}
          onPress={() => setRatesOpen(true)}
          disabled={!rates}>
          <View>
            <Text style={styles.ratesLabel}>Current rates</Text>
            <Text style={styles.ratesValue}>
              {rates
                ? `Milk ${formatMoney(rates.milk)}/P · Curd ${formatMoney(rates.curd)}/P`
                : 'Unavailable'}
            </Text>
            <Text style={styles.ratesHint}>1 packet = {formatQty(PACKET_SIZE)} L</Text>
          </View>
          <Text style={styles.link}>Edit</Text>
        </Pressable>

        {/* Month switcher */}
        <View style={styles.monthRow}>
          <Pressable onPress={() => setMonth(shiftMonth(month, -1))} hitSlop={12}>
            <Text style={styles.monthArrow}>‹</Text>
          </Pressable>
          <Text style={styles.monthLabel}>{monthLabel(month)}</Text>
          <Pressable onPress={() => setMonth(shiftMonth(month, 1))} hitSlop={12}>
            <Text style={styles.monthArrow}>›</Text>
          </Pressable>
        </View>

        {/* What you owe */}
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Amount for this month</Text>
          <Text style={styles.totalValue}>{totals ? formatMoney(totals.total) : '—'}</Text>
          {totals && rates ? (
            <View style={styles.breakdown}>
              <Text style={styles.breakdownRow}>
                Milk {formatQty(totals.milkQty)} L = {formatQty(totals.milkPackets)} packets ×{' '}
                {formatMoney(rates.milk)} = {formatMoney(totals.milkAmount)}
              </Text>
              <Text style={styles.breakdownRow}>
                Curd {formatQty(totals.curdQty)} L = {formatQty(totals.curdPackets)} packets ×{' '}
                {formatMoney(rates.curd)} = {formatMoney(totals.curdAmount)}
              </Text>
              <Text style={styles.breakdownRow}>Recorded on {totals.days} days</Text>
            </View>
          ) : null}
        </View>

        {/* Add / edit a day */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{editingExisting ? 'Edit day' : 'Add for a day'}</Text>

          <Text style={styles.label}>Date</Text>
          <DateField value={date} onChange={editDate} />

          <Text style={styles.label}>
            Milk (litres){milkPackets > 0 ? ` · ${formatQty(milkPackets)} packets` : ''}
          </Text>
          <QuantityPicker value={milk} onChange={setMilk} />

          <Text style={styles.label}>
            Curd (litres){curdPackets > 0 ? ` · ${formatQty(curdPackets)} packets` : ''}
          </Text>
          <QuantityPicker value={curd} onChange={setCurd} />

          <Text style={styles.reminderNote}>
            {remindersOn
              ? `Reminders at ${describeSlots()}, and they stop for a day once it's recorded.` +
                (scheduled > 0 ? ` ${scheduled} scheduled.` : '')
              : `Reminders at ${describeSlots()} need notification permission.`}
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.saveButton,
              saving && styles.saveDisabled,
              pressed && styles.pressed,
            ]}
            onPress={handleSaveEntry}
            disabled={saving}
            android_ripple={{ color: '#FFFFFF33' }}>
            <Text style={styles.saveText}>
              {saving ? 'Saving…' : editingExisting ? 'Update entry' : 'Save entry'}
            </Text>
          </Pressable>
        </View>

        {/* Days with nothing recorded */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Missed days ({missed.length})</Text>
          {missed.length === 0 ? (
            <Text style={styles.muted}>Every day so far is recorded.</Text>
          ) : (
            <>
              <Text style={styles.muted}>Tap a day to fill it in.</Text>
              <View style={[styles.chips, styles.missedChips]}>
                {missed.map((iso) => (
                  <Pressable key={iso} style={styles.missedChip} onPress={() => editDate(iso)}>
                    <Text style={styles.missedChipText}>{shortDate(iso)}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}
        </View>

        {/* The month's ledger */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Entries ({entries.length})</Text>
          {entries.length === 0 ? (
            <Text style={styles.muted}>Nothing recorded for this month yet.</Text>
          ) : (
            entries.map((entry) => (
              <Pressable
                key={entry.date}
                style={styles.entryRow}
                onPress={() => editDate(entry.date)}
                onLongPress={() => setPendingDelete(entry)}>
                <Text style={styles.entryDate}>{shortDate(entry.date)}</Text>
                <Text style={styles.entryQty}>
                  {formatQty(packetsFor(entry.milk))}P milk · {formatQty(packetsFor(entry.curd))}P
                  curd
                </Text>
                <Text style={styles.entryAmount}>{formatMoney(entry.amount)}</Text>
              </Pressable>
            ))
          )}
          {entries.length > 0 ? (
            <Text style={styles.hint}>Tap to edit · long-press to delete</Text>
          ) : null}
        </View>
      </ScrollView>

      <ConfirmModal
        visible={pendingDelete !== null}
        title="Delete entry"
        message={
          pendingDelete
            ? `Remove the record for ${shortDate(pendingDelete.date)}? This can't be undone.`
            : ''
        }
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />

      {rates ? (
        <RatesModal
          visible={ratesOpen}
          rates={rates}
          onClose={() => setRatesOpen(false)}
          onSave={handleSaveRates}
        />
      ) : null}
    </View>
  );
}

/** Preset chips only — the amounts actually delivered, nothing to type. */
function QuantityPicker({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  return (
    <View style={styles.chips}>
      {QUANTITY_PRESETS.map((preset) => {
        const active = Number.parseFloat(value || '-1') === preset;
        return (
          <Pressable
            key={preset}
            onPress={() => onChange(String(preset))}
            style={[styles.chip, active && styles.chipActive]}>
            <Text style={[styles.chipText, active && styles.chipTextActive]}>
              {formatQty(preset)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingTop: 44 },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  backButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  backPressed: { opacity: 0.85 },
  back: { color: colors.accent, fontWeight: '700', fontSize: 16 },
  title: { marginTop: 6, fontSize: 24, fontWeight: '700', color: colors.text },
  content: { padding: 20, paddingTop: 12, paddingBottom: 48 },

  ratesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
  },
  ratesLabel: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  ratesValue: { marginTop: 2, fontSize: 15, color: colors.text, fontWeight: '600' },
  ratesHint: { marginTop: 2, fontSize: 12, color: colors.muted },
  link: { color: colors.accent, fontWeight: '600' },

  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginTop: 18,
  },
  monthArrow: { fontSize: 26, color: colors.accent, paddingHorizontal: 12 },
  monthLabel: { fontSize: 16, fontWeight: '700', color: colors.text },

  totalCard: { marginTop: 12, backgroundColor: colors.accent, borderRadius: 16, padding: 18 },
  totalLabel: { color: '#FFFFFFCC', fontSize: 13, fontWeight: '600' },
  totalValue: { color: '#FFFFFF', fontSize: 36, fontWeight: '700', marginTop: 2 },
  breakdown: { marginTop: 12, gap: 3 },
  breakdownRow: { color: '#FFFFFFDD', fontSize: 13 },

  card: {
    marginTop: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 16,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 8 },
  label: { marginTop: 14, marginBottom: 6, fontSize: 13, fontWeight: '600', color: colors.muted },
  muted: { color: colors.muted, fontSize: 13 },
  hint: { marginTop: 10, color: colors.muted, fontSize: 12, textAlign: 'center' },
  reminderNote: { marginTop: 16, fontSize: 12, color: colors.muted, lineHeight: 17 },


  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontSize: 14, color: colors.muted, fontWeight: '600' },
  chipTextActive: { color: '#FFFFFF' },

  missedChips: { marginTop: 12 },
  missedChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#FDECEC',
    borderWidth: 1,
    borderColor: '#F5C6C6',
  },
  missedChipText: { color: colors.overdue, fontWeight: '600', fontSize: 13 },

  saveButton: {
    marginTop: 20,
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveDisabled: { opacity: 0.6 },
  pressed: { opacity: 0.85 },
  saveText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },

  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  entryDate: { width: 72, fontSize: 14, fontWeight: '600', color: colors.text },
  entryQty: { flex: 1, fontSize: 14, color: colors.muted },
  entryAmount: { fontSize: 14, fontWeight: '700', color: colors.text },
});
