import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { describeBought } from '../shopping/list';
import type { ShoppingItem } from '../api/types';
import { colors } from '../theme';

type Props = {
  visible: boolean;
  items: ShoppingItem[];
  onClose: () => void;
  onAddAgain: (item: ShoppingItem) => void;
  onRemove: (item: ShoppingItem) => void;
};

export function BoughtModal({ visible, items, onClose, onAddAgain, onRemove }: Props) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Bottom sheet: sized to its content, capped at half the screen. */}
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.grabber} />

          <View style={styles.header}>
            <Text style={styles.heading}>Bought ({items.length})</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.close}>Close</Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator
            bounces={false}>
          {items.length === 0 ? (
            <Text style={styles.empty}>Nothing bought yet.</Text>
          ) : (
            items.map((item) => (
              <View key={item.id} style={styles.row}>
                <View style={styles.textBlock}>
                  <Text style={styles.name}>
                    {item.name} <Text style={styles.qty}>× {item.quantity}</Text>
                  </Text>
                  <Text style={styles.meta}>{describeBought(item.boughtAt)}</Text>
                </View>

                <Pressable
                  style={({ pressed }) => [styles.again, pressed && styles.pressed]}
                  onPress={() => onAddAgain(item)}
                  android_ripple={{ color: '#FFFFFF33' }}>
                  <Text style={styles.againText}>Add again</Text>
                </Pressable>
                <Pressable style={styles.remove} onPress={() => onRemove(item)} hitSlop={8}>
                  <Text style={styles.removeText}>✕</Text>
                </Pressable>
              </View>
            ))
          )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#00000066', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    // Fixed, not a cap: the sheet opens the same size whether it holds two items or twenty.
    height: '75%',
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  heading: { fontSize: 20, fontWeight: '700', color: colors.text },
  close: { color: colors.accent, fontWeight: '600' },
  list: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 28 },
  empty: { textAlign: 'center', paddingVertical: 28, color: colors.muted },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  textBlock: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600', color: colors.muted, textDecorationLine: 'line-through' },
  qty: { fontWeight: '700' },
  meta: { marginTop: 3, fontSize: 12, color: colors.muted },
  again: {
    backgroundColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  pressed: { opacity: 0.85 },
  againText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  remove: { paddingHorizontal: 4, paddingVertical: 4 },
  removeText: { color: colors.muted, fontSize: 16, fontWeight: '600' },
});
