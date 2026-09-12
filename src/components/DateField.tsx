import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fromISODate, toISODate, today } from '../dates';
import { colors } from '../theme';

type Props = {
  /** Local yyyy-mm-dd. */
  value: string;
  onChange: (iso: string) => void;
  /** Defaults to today — you can't record a delivery that hasn't happened. */
  maximumDate?: Date;
  minimumDate?: Date;
};

/** "Fri, 11 Sep 2026" — unambiguous without being long. */
function pretty(iso: string): string {
  return fromISODate(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function DateField({ value, onChange, maximumDate, minimumDate }: Props) {
  const safe = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : today();
  const isToday = safe === today();

  function open() {
    DateTimePickerAndroid.open({
      value: fromISODate(safe),
      mode: 'date',
      maximumDate: maximumDate ?? new Date(),
      minimumDate,
      // onChange is deprecated; onValueChange only fires on an actual pick,
      // and a cancel goes to onDismiss instead.
      onValueChange: (_event, selected) => {
        if (selected) onChange(toISODate(selected));
      },
    });
  }

  return (
    <View style={styles.row}>
      <Pressable
        style={({ pressed }) => [styles.field, pressed && styles.pressed]}
        onPress={open}
        android_ripple={{ color: '#00000010' }}>
        <Text style={styles.value}>{pretty(safe)}</Text>
        <Text style={styles.icon}>▾</Text>
      </Pressable>
      {!isToday ? (
        <Pressable style={styles.todayButton} onPress={() => onChange(today())} hitSlop={8}>
          <Text style={styles.link}>Today</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  pressed: { opacity: 0.85 },
  value: { fontSize: 15, color: colors.text, fontWeight: '600' },
  icon: { fontSize: 13, color: colors.muted },
  todayButton: { paddingHorizontal: 6, paddingVertical: 10 },
  link: { color: colors.accent, fontWeight: '600' },
});
