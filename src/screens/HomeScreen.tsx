import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';

import { laundryApi, milkApi, shoppingApi } from '../api';
import { describeError } from '../api/client';
import { currentMonth, formatMoney, monthLabel } from '../milk/calc';
import { ErrorBanner } from '../components/ErrorBanner';
import { colors } from '../theme';

export type Route = 'home' | 'milk' | 'shopping' | 'laundry';

type Props = { onNavigate: (route: Route) => void };

export function HomeScreen({ onNavigate }: Props) {
  const [milkSummary, setMilkSummary] = useState('Loading…');
  const [shoppingSummary, setShoppingSummary] = useState('Loading…');
  const [laundrySummary, setLaundrySummary] = useState('Loading…');
  const [error, setError] = useState<string | null>(null);

  // Remounts every time we come back from a screen, so the summaries stay current.
  // Each card asks for its own summary; one failing shouldn't blank the others.
  useEffect(() => {
    let cancelled = false;

    const show = (set: (value: string) => void) => (result: PromiseSettledResult<string>) => {
      if (cancelled) return;
      if (result.status === 'fulfilled') set(result.value);
      else {
        set('Unavailable');
        setError(describeError(result.reason));
      }
    };

    (async () => {
      const [milk, shopping, laundry] = await Promise.allSettled([
        milkApi.summary().then(({ totals, missedDays }) => {
          const missed = missedDays.length;
          return `${formatMoney(totals.total)} this month · ${missed} day${
            missed === 1 ? '' : 's'
          } missed`;
        }),
        shoppingApi.list().then(
          ({ pending, bought }) => `${pending.length} to buy · ${bought.length} bought`,
        ),
        laundryApi.get().then((state) => {
          const parts = [`${state.washes.sinceDescale} washes`];
          if (state.dry) parts.unshift('Clothes drying');
          if (state.descale.needed) parts.push('descale due');
          return parts.join(' · ');
        }),
      ]);

      show(setMilkSummary)(milk);
      show(setShoppingSummary)(shopping);
      show(setLaundrySummary)(laundry);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.greeting}>Home</Text>
        <Text style={styles.month}>{monthLabel(currentMonth())}</Text>
        {error ? <ErrorBanner message={error} /> : null}

        <Card
          title="Milk &amp; Curd"
          subtitle={milkSummary}
          detail="Daily quantities, rates and the monthly bill"
          onPress={() => onNavigate('milk')}
        />

        <Card
          title="Shopping list"
          subtitle={shoppingSummary}
          detail="What to buy, and what's already bought"
          onPress={() => onNavigate('shopping')}
        />

        <Card
          title="Laundry"
          subtitle={laundrySummary}
          detail="Drying reminder, wash count and descaling"
          onPress={() => onNavigate('laundry')}
        />
      </ScrollView>
    </View>
  );
}

type CardProps = {
  title: string;
  subtitle: string;
  detail: string;
  onPress?: () => void;
  disabled?: boolean;
};

function Card({ title, subtitle, detail, onPress, disabled }: CardProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, disabled && styles.cardDisabled, pressed && styles.pressed]}
      onPress={onPress}
      disabled={disabled}
      android_ripple={disabled ? undefined : { color: '#00000010' }}>
      <View style={styles.cardTextBlock}>
        <Text style={[styles.cardTitle, disabled && styles.mutedText]}>{title}</Text>
        <Text style={[styles.cardSubtitle, disabled && styles.mutedText]}>{subtitle}</Text>
        <Text style={styles.cardDetail}>{detail}</Text>
      </View>
      {!disabled ? <Text style={styles.chevron}>›</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingTop: 44 },
  content: { padding: 20, paddingBottom: 48 },
  greeting: { fontSize: 28, fontWeight: '700', color: colors.text },
  month: { marginTop: 2, marginBottom: 20, fontSize: 14, color: colors.muted },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
  },
  cardDisabled: { opacity: 0.6 },
  pressed: { opacity: 0.9 },
  cardTextBlock: { flex: 1 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  cardSubtitle: { marginTop: 4, fontSize: 14, fontWeight: '600', color: colors.accent },
  cardDetail: { marginTop: 4, fontSize: 13, color: colors.muted },
  mutedText: { color: colors.muted },
  chevron: { fontSize: 28, color: colors.muted, paddingLeft: 12 },
});
