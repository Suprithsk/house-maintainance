import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
};

/** In-app replacement for Alert.alert, which renders a system dialog that ignores our design. */
export function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel = 'Delete',
  onCancel,
  onConfirm,
}: Props) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.heading}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.actions}>
            <Pressable style={styles.cancel} onPress={onCancel} android_ripple={{ color: '#00000010' }}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.confirm, pressed && styles.pressed]}
              onPress={onConfirm}
              android_ripple={{ color: '#FFFFFF33' }}>
              <Text style={styles.confirmText}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#00000066', justifyContent: 'center', padding: 24 },
  sheet: { backgroundColor: colors.card, borderRadius: 16, padding: 20 },
  heading: { fontSize: 18, fontWeight: '700', color: colors.text },
  message: { marginTop: 8, fontSize: 14, lineHeight: 20, color: colors.muted },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 24 },
  cancel: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10 },
  cancelText: { color: colors.muted, fontWeight: '600' },
  confirm: {
    backgroundColor: colors.overdue,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
  },
  pressed: { opacity: 0.85 },
  confirmText: { color: '#FFFFFF', fontWeight: '700' },
});
