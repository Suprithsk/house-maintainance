import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors } from '../theme';
import type { Rates } from '../api/types';
import { PACKET_SIZE } from '../milk/types';

type Props = {
  visible: boolean;
  rates: Rates;
  onClose: () => void;
  onSave: (rates: Rates) => void;
};

export function RatesModal({ visible, rates, onClose, onSave }: Props) {
  const [milk, setMilk] = useState(String(rates.milk));
  const [curd, setCurd] = useState(String(rates.curd));

  useEffect(() => {
    if (!visible) return;
    setMilk(String(rates.milk));
    setCurd(String(rates.curd));
  }, [visible, rates]);

  function handleSave() {
    const milkRate = Number.parseFloat(milk);
    const curdRate = Number.parseFloat(curd);
    if (!Number.isFinite(milkRate) || milkRate < 0 || !Number.isFinite(curdRate) || curdRate < 0) {
      Alert.alert('Check the rates', 'Enter both rates as positive numbers.');
      return;
    }
    onSave({ milk: milkRate, curd: curdRate });
  }

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.heading}>Rates</Text>
          <Text style={styles.hint}>Used to calculate every month's bill.</Text>

          <Text style={styles.label}>Milk (₹ per packet of {PACKET_SIZE} L)</Text>
          <TextInput
            style={styles.input}
            value={milk}
            onChangeText={setMilk}
            keyboardType="decimal-pad"
            placeholder="27"
            placeholderTextColor={colors.muted}
          />

          <Text style={styles.label}>Curd (₹ per packet of {PACKET_SIZE} L)</Text>
          <TextInput
            style={styles.input}
            value={curd}
            onChangeText={setCurd}
            keyboardType="decimal-pad"
            placeholder="28"
            placeholderTextColor={colors.muted}
          />

          <View style={styles.actions}>
            <Pressable style={styles.cancel} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.save, pressed && styles.pressed]}
              onPress={handleSave}
              android_ripple={{ color: '#FFFFFF33' }}>
              <Text style={styles.saveText}>Save rates</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#00000066',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: { backgroundColor: colors.card, borderRadius: 16, padding: 20 },
  heading: { fontSize: 18, fontWeight: '700', color: colors.text },
  hint: { marginTop: 4, fontSize: 13, color: colors.muted },
  label: { marginTop: 18, marginBottom: 6, fontSize: 13, fontWeight: '600', color: colors.muted },
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
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 24 },
  cancel: { paddingHorizontal: 16, paddingVertical: 12 },
  cancelText: { color: colors.muted, fontWeight: '600' },
  save: {
    backgroundColor: colors.accent,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
  },
  pressed: { opacity: 0.85 },
  saveText: { color: '#FFFFFF', fontWeight: '700' },
});
