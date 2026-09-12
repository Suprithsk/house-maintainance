import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { laundryApi } from '../api';
import { describeError } from '../api/client';
import type { LaundryState } from '../api/types';
import { ConfirmModal } from '../components/ConfirmModal';
import { ErrorBanner } from '../components/ErrorBanner';
import {
  describeDelay,
  describeDueAt,
  describeRemaining,
  describeWash,
  isOverdue,
} from '../laundry/logic';
import { loadScheduled, updateScheduled } from '../deviceNotifications';
import { DESCALE_NAG_HOUR } from '../laundry/types';
import {
  cancelReminders,
  remindersSupported,
  scheduleDaily,
  scheduleSeries,
  setupNotifications,
} from '../notifications';
import { colors } from '../theme';

type Props = { onBack: () => void };

const DRY_TITLE = 'Clothes put to dry';

export function LaundryScreen({ onBack }: Props) {
  const [state, setState] = useState<LaundryState | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [delayDays, setDelayDays] = useState<number | null>(null);
  const [notificationsOn, setNotificationsOn] = useState(true);
  const [confirmDescale, setConfirmDescale] = useState(false);
  const [now, setNow] = useState(Date.now());

  const permissionRef = useRef(false);

  /**
   * Bring this phone's alarms in line with the server's state: the dry series
   * from `reminderTimes` (past slots already dropped server-side), and the daily
   * descale nag while the count is over the limit.
   */
  const syncNotifications = useCallback(async (next: LaundryState) => {
    if (!permissionRef.current) return;
    const scheduled = await loadScheduled();

    await cancelReminders(scheduled.dry);
    const dry = next.dry
      ? await scheduleSeries(
          next.dry.reminderTimes.map((iso) => new Date(iso)),
          DRY_TITLE,
          (index) =>
            index === 0 ? 'Time to bring them in.' : 'Still hanging out — bring them in.',
        )
      : [];

    let descale = scheduled.descale;
    if (next.descale.needed && descale.length === 0) {
      const body = `${next.washes.sinceDescale} washes done — run a descaling powder cycle.`;
      const immediate = await scheduleSeries(
        [new Date(Date.now() + 60_000)],
        'Descaling wash due',
        () => body,
      );
      const daily = await scheduleDaily(DESCALE_NAG_HOUR, 0, 'Descaling wash due', body);
      descale = daily ? [...immediate, daily] : immediate;
    } else if (!next.descale.needed && descale.length > 0) {
      await cancelReminders(descale);
      descale = [];
    }

    await updateScheduled({ dry, descale });
  }, []);

  const load = useCallback(async () => {
    try {
      setError(null);
      const next = await laundryApi.get();
      setState(next);
      await syncNotifications(next);
      return next;
    } catch (err) {
      setError(describeError(err));
      return null;
    }
  }, [syncNotifications]);

  useEffect(() => {
    (async () => {
      permissionRef.current = await setupNotifications();
      setNotificationsOn(permissionRef.current);
      await load();
      setLoading(false);
    })();

    const timer = setInterval(() => setNow(Date.now()), 60_000);
    const appState = AppState.addEventListener('change', (s) => {
      if (s === 'active') setNow(Date.now());
    });
    return () => {
      clearInterval(timer);
      appState.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Laundry writes answer with the whole new state, so nothing needs a refetch. */
  const run = useCallback(
    async (action: () => Promise<LaundryState>) => {
      setBusy(true);
      try {
        setError(null);
        const next = await action();
        setState(next);
        await syncNotifications(next);
      } catch (err) {
        setError(describeError(err));
      } finally {
        setBusy(false);
      }
    },
    [syncNotifications],
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const completeDescale = useCallback(async () => {
    setConfirmDescale(false);
    await run(() => laundryApi.descaled());
  }, [run]);

  if (loading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const settings = state?.settings;
  const chosenDelay = delayDays ?? settings?.defaultDryDelay ?? 1.5;
  const dryOverdue = state?.dry ? isOverdue(state.dry.dueAt, now) : false;
  const washes = state?.washes.sinceDescale ?? 0;
  const limit = state?.descale.limit ?? 25;
  const descaleDue = state?.descale.needed ?? false;

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
        <Text style={styles.title}>Laundry</Text>
        {!notificationsOn ? (
          <Text style={styles.warning}>
            {remindersSupported()
              ? 'Notifications are off, so nothing will alert you. Enable them in Android settings.'
              : 'Running in Expo Go — alerts need a dev build. Timers still count down here.'}
          </Text>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        {error ? <ErrorBanner message={error} onRetry={refresh} /> : null}

        {/* Descale warning sits at the top once it's due */}
        {descaleDue ? (
          <View style={styles.alertCard}>
            <Text style={styles.alertTitle}>Descaling wash due</Text>
            <Text style={styles.alertBody}>
              {washes} washes done. Run a cycle with descaling powder, then reset the count.
            </Text>
            <Pressable
              style={({ pressed }) => [styles.alertButton, pressed && styles.pressed]}
              onPress={() => setConfirmDescale(true)}
              disabled={busy}
              android_ripple={{ color: '#FFFFFF33' }}>
              <Text style={styles.alertButtonText}>Descaling completed</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Drying */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Clothes to dry</Text>

          {state?.dry ? (
            <>
              <Text style={[styles.bigStatus, dryOverdue && styles.bigStatusDue]}>
                {dryOverdue ? 'Bring them in' : describeRemaining(state.dry.dueAt, now)}
              </Text>
              <Text style={styles.meta}>
                Hung out {describeRemaining(state.dry.startedAt, now)} · reminder{' '}
                {describeDueAt(state.dry.dueAt)}
              </Text>
              {dryOverdue && settings ? (
                <Text style={styles.nag}>
                  Nagging every {settings.repeatHours}h until brought in
                </Text>
              ) : null}

              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  dryOverdue && styles.primaryButtonDue,
                  busy && styles.disabled,
                  pressed && styles.pressed,
                ]}
                onPress={() => run(() => laundryApi.clearDry())}
                disabled={busy}
                android_ripple={{ color: '#FFFFFF33' }}>
                <Text style={styles.primaryText}>Brought them in</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.label}>Remind me after</Text>
              <View style={styles.chips}>
                {(settings?.dryDelayPresets ?? [0.5, 1, 1.5, 2]).map((preset) => {
                  const active = preset === chosenDelay;
                  return (
                    <Pressable
                      key={preset}
                      onPress={() => setDelayDays(preset)}
                      style={[styles.chip, active && styles.chipActive]}>
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {describeDelay(preset)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  busy && styles.disabled,
                  pressed && styles.pressed,
                ]}
                onPress={() => run(() => laundryApi.startDry(chosenDelay))}
                disabled={busy}
                android_ripple={{ color: '#FFFFFF33' }}>
                <Text style={styles.primaryText}>Clothes put to dry</Text>
              </Pressable>
            </>
          )}
        </View>

        {/* Machine washes */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Machine washes</Text>

          <View style={styles.countBlock}>
            <Text style={[styles.count, descaleDue && styles.countDue]}>{washes}</Text>
            <Text style={styles.countLabel}>
              {descaleDue ? `washes — over ${limit}` : `of ${limit} washes`}
            </Text>
          </View>

          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.min(100, (washes / limit) * 100)}%` },
                descaleDue && styles.progressFillDue,
              ]}
            />
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              busy && styles.disabled,
              pressed && styles.pressed,
            ]}
            onPress={() => run(() => laundryApi.logWash())}
            disabled={busy}
            android_ripple={{ color: '#FFFFFF33' }}>
            <Text style={styles.primaryText}>Log a wash</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.secondaryButton,
              !descaleDue && styles.secondaryDisabled,
              pressed && styles.pressed,
            ]}
            onPress={() => setConfirmDescale(true)}
            disabled={!descaleDue || busy}
            android_ripple={descaleDue ? { color: '#FFFFFF33' } : undefined}>
            <Text style={[styles.secondaryText, !descaleDue && styles.secondaryTextDisabled]}>
              Descaling completed
            </Text>
          </Pressable>
          {!descaleDue ? (
            <Text style={styles.metaCentered}>Available after {limit} washes</Text>
          ) : null}

          {!descaleDue && state?.descale.lastDescaleAt ? (
            <Text style={styles.meta}>
              Last descaled {describeWash(state.descale.lastDescaleAt)}
            </Text>
          ) : null}

          {state && state.washes.recent.length > 0 ? (
            <View style={styles.recent}>
              <Text style={styles.label}>Recent</Text>
              {state.washes.recent.slice(0, 5).map((wash) => (
                <Text key={wash.id} style={styles.recentRow}>
                  {describeWash(wash.washedAt)}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>

      <ConfirmModal
        visible={confirmDescale}
        title="Descaling completed"
        message={`Reset the counter? The next descale is due after ${limit} more washes.`}
        confirmLabel="Reset count"
        onCancel={() => setConfirmDescale(false)}
        onConfirm={completeDescale}
      />
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
  warning: { marginTop: 8, fontSize: 12, color: colors.soon },
  content: { padding: 20, paddingTop: 12, paddingBottom: 48 },

  alertCard: {
    backgroundColor: '#FDECEC',
    borderWidth: 1,
    borderColor: '#F5C6C6',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  alertTitle: { fontSize: 16, fontWeight: '700', color: colors.overdue },
  alertBody: { marginTop: 4, fontSize: 13, color: colors.overdue, lineHeight: 19 },
  alertButton: {
    marginTop: 14,
    backgroundColor: colors.overdue,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  alertButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  card: {
    marginBottom: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 16,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 10 },
  label: { marginTop: 12, marginBottom: 8, fontSize: 13, fontWeight: '600', color: colors.muted },
  meta: { marginTop: 10, fontSize: 13, color: colors.muted },
  metaCentered: { marginTop: 6, fontSize: 12, color: colors.muted, textAlign: 'center' },
  nag: { marginTop: 6, fontSize: 12, color: colors.overdue, fontWeight: '600' },

  bigStatus: { fontSize: 26, fontWeight: '700', color: colors.accent },
  bigStatusDue: { color: colors.overdue },

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

  primaryButton: {
    marginTop: 18,
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryButtonDue: { backgroundColor: colors.overdue },
  disabled: { opacity: 0.6 },
  pressed: { opacity: 0.85 },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  secondaryButton: {
    marginTop: 10,
    backgroundColor: colors.overdue,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  secondaryDisabled: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  secondaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  secondaryTextDisabled: { color: colors.muted },

  countBlock: { alignItems: 'center', paddingVertical: 8 },
  count: { fontSize: 52, fontWeight: '700', color: colors.text, lineHeight: 58 },
  countDue: { color: colors.overdue },
  countLabel: { marginTop: 2, fontSize: 13, color: colors.muted, fontWeight: '600' },

  progressTrack: {
    marginTop: 14,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.bg,
    overflow: 'hidden',
  },
  progressFill: { height: 8, borderRadius: 4, backgroundColor: colors.accent },
  progressFillDue: { backgroundColor: colors.overdue },

  recent: { marginTop: 6 },
  recentRow: {
    fontSize: 13,
    color: colors.muted,
    paddingVertical: 7,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
