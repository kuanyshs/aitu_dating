import { View } from 'react-native';

import { radius, spacing } from '@/ui/theme/tokens';
import { createStyles } from '@/ui/theme/useStyles';

/** Post-shaped placeholders so loading keeps the feed geometry and shows no fake data. */
export function FeedSkeleton({ rows = 4 }: { rows?: number }) {
  const styles = useStyles();
  return (
    <View testID="feed-skeleton" aria-busy role="progressbar">
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={styles.row}>
          <View style={styles.avatar} />
          <View style={styles.body}>
            <View style={[styles.line, { width: '40%' }]} />
            <View style={[styles.line, { width: '95%' }]} />
            <View style={[styles.line, { width: '80%' }]} />
            <View style={[styles.line, { width: '55%' }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.surfacePressed,
  },
  body: { flex: 1, gap: spacing.sm },
  line: { height: 12, borderRadius: radius.sm, backgroundColor: colors.surfacePressed },
}));
