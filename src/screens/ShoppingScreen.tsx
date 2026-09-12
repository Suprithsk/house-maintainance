import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { shoppingApi } from '../api';
import { describeError } from '../api/client';
import type { ShoppingItem, ShoppingList } from '../api/types';
import { BoughtModal } from '../components/BoughtModal';
import { ConfirmModal } from '../components/ConfirmModal';
import { ErrorBanner } from '../components/ErrorBanner';
import { DEFAULT_QUANTITY } from '../shopping/types';
import { colors } from '../theme';

type Props = { onBack: () => void };

export function ShoppingScreen({ onBack }: Props) {
  const [list, setList] = useState<ShoppingList>({ pending: [], bought: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [quantity, setQty] = useState(DEFAULT_QUANTITY);
  const [boughtOpen, setBoughtOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ShoppingItem | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setList(await shoppingApi.list());
    } catch (err) {
      setError(describeError(err));
    }
  }, []);

  useEffect(() => {
    (async () => {
      await load();
      setLoading(false);
    })();
  }, [load]);

  /** Every write answers with one item, so the list is refetched to stay ordered. */
  const run = useCallback(
    async (action: () => Promise<unknown>) => {
      try {
        await action();
        await load();
      } catch (err) {
        setError(describeError(err));
      }
    },
    [load],
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const pending = list.pending;
  const bought = list.bought;

  const handleAdd = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setName('');
    setQty(DEFAULT_QUANTITY);
    await run(() => shoppingApi.add(trimmed, quantity));
  }, [name, quantity, run]);

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);
    await run(() => shoppingApi.remove(target.id));
  }, [pendingDelete, run]);

  if (loading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

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
        <Text style={styles.title}>Shopping list</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        {error ? <ErrorBanner message={error} onRetry={refresh} /> : null}

        {/* Add an item */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Add an item</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Atta, onions, dish soap"
            placeholderTextColor={colors.muted}
            returnKeyType="done"
            onSubmitEditing={handleAdd}
          />

          <View style={styles.addRow}>
            <Stepper value={quantity} onChange={setQty} />
            <Pressable
              style={({ pressed }) => [
                styles.addButton,
                !name.trim() && styles.addButtonDisabled,
                pressed && styles.pressed,
              ]}
              onPress={handleAdd}
              disabled={!name.trim()}
              android_ripple={{ color: '#FFFFFF33' }}>
              <Text style={styles.addText}>Add</Text>
            </Pressable>
          </View>
        </View>

        {/* To buy */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>To buy ({pending.length})</Text>
            <Pressable onPress={() => setBoughtOpen(true)} hitSlop={8}>
              <Text style={styles.link}>Bought ({bought.length})</Text>
            </Pressable>
          </View>

          {pending.length === 0 ? (
            <Text style={styles.muted}>Nothing on the list. Add something above.</Text>
          ) : (
            pending.map((item) => (
              <View key={item.id} style={styles.row}>
                <Pressable
                  style={styles.checkbox}
                  onPress={() => run(() => shoppingApi.markBought(item.id))}
                  hitSlop={8}
                />
                <Text style={styles.name} numberOfLines={2}>
                  {item.name}
                </Text>
                <Stepper
                  value={item.quantity}
                  onChange={(next) => run(() => shoppingApi.setQuantity(item.id, next))}
                  compact
                />
                <Pressable onPress={() => setPendingDelete(item)} hitSlop={8}>
                  <Text style={styles.removeText}>✕</Text>
                </Pressable>
              </View>
            ))
          )}
          {pending.length > 0 ? (
            <Text style={styles.hint}>Tap the circle when you've bought it</Text>
          ) : null}
        </View>
      </ScrollView>

      <BoughtModal
        visible={boughtOpen}
        items={bought}
        onClose={() => setBoughtOpen(false)}
        onAddAgain={(item) => run(() => shoppingApi.markPending(item.id))}
        onRemove={(item) => run(() => shoppingApi.remove(item.id))}
      />

      <ConfirmModal
        visible={pendingDelete !== null}
        title="Remove item"
        message={pendingDelete ? `Remove "${pendingDelete.name}" from the list?` : ''}
        confirmLabel="Remove"
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </View>
  );
}

function Stepper({
  value,
  onChange,
  compact,
}: {
  value: number;
  onChange: (next: number) => void;
  compact?: boolean;
}) {
  return (
    <View style={[styles.stepper, compact && styles.stepperCompact]}>
      <Pressable
        style={styles.stepButton}
        onPress={() => onChange(Math.max(1, value - 1))}
        hitSlop={6}>
        <Text style={styles.stepText}>−</Text>
      </Pressable>
      <Text style={styles.stepValue}>{value}</Text>
      <Pressable style={styles.stepButton} onPress={() => onChange(value + 1)} hitSlop={6}>
        <Text style={styles.stepText}>+</Text>
      </Pressable>
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

  card: {
    marginBottom: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 8 },
  link: { color: colors.accent, fontWeight: '600', marginBottom: 8 },
  muted: { color: colors.muted, fontSize: 13 },
  hint: { marginTop: 12, color: colors.muted, fontSize: 12, textAlign: 'center' },

  input: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
  },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  addButton: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  addButtonDisabled: { backgroundColor: colors.border },
  pressed: { opacity: 0.85 },
  addText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.accent,
  },
  name: { flex: 1, fontSize: 15, color: colors.text, fontWeight: '500' },
  removeText: { color: colors.muted, fontSize: 16, fontWeight: '600' },

  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
  },
  stepperCompact: { backgroundColor: colors.card },
  stepButton: { paddingHorizontal: 12, paddingVertical: 8 },
  stepText: { fontSize: 18, color: colors.accent, fontWeight: '700', lineHeight: 20 },
  stepValue: { minWidth: 20, textAlign: 'center', fontSize: 15, fontWeight: '700', color: colors.text },
});
