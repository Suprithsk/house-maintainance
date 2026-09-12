import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme';

type Props = {
  message: string;
  onRetry?: () => void;
};

/** One line explaining why the screen has no data, with a way to try again. */
export function ErrorBanner({ message, onRetry }: Props) {
  return (
    <View style={styles.banner}>
      <Text style={styles.text}>{message}</Text>
      {onRetry ? (
        <Pressable style={styles.retry} onPress={onRetry} hitSlop={8}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FDECEC',
    borderWidth: 1,
    borderColor: '#F5C6C6',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  text: { flex: 1, color: colors.overdue, fontSize: 13, lineHeight: 19 },
  retry: {
    backgroundColor: colors.overdue,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
});
