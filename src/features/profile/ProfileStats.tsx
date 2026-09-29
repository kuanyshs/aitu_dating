import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import type { ProfileView } from '@/contracts';
import { AppText } from '@/ui/components/Text';
import { strings } from '@/ui/strings';
import { radius, spacing } from '@/ui/theme/tokens';
import { createStyles } from '@/ui/theme/useStyles';

type Props = {
  memberId: string;
  stats: ProfileView['stats'];
  /** «Подписчики» and «Подписки» open their lists; only for active members. */
  openLists: boolean;
  testID: string;
};

/** Публикации · Подписчики · Подписки, on another member's profile and on one's own. */
export function ProfileStats({ memberId, stats, openLists, testID }: Props) {
  const styles = useStyles();
  const router = useRouter();
  const t = strings.member.stats;
  const cell = (key: keyof ProfileView['stats']) => (
    <>
      <AppText variant="title">{String(stats[key])}</AppText>
      <AppText variant="caption" tone="textMuted">
        {t[key]}
      </AppText>
    </>
  );
  return (
    <View style={styles.stats} testID={testID}>
      <View style={styles.stat} testID={`${testID}-posts`}>
        {cell('posts')}
      </View>
      {(['followers', 'following'] as const).map((tab) =>
        openLists ? (
          <Pressable
            key={tab}
            role="link"
            aria-label={`${t[tab]}: ${stats[tab]}`}
            onPress={() => router.push({ pathname: '/follows', params: { memberId, tab } })}
            style={({ pressed }) => [styles.stat, pressed && styles.pressed]}
            testID={`${testID}-${tab}`}
          >
            {cell(tab)}
          </Pressable>
        ) : (
          <View key={tab} style={styles.stat} testID={`${testID}-${tab}`}>
            {cell(tab)}
          </View>
        ),
      )}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  stats: {
    flexDirection: 'row',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  stat: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, gap: 2 },
  pressed: { backgroundColor: colors.surfacePressed },
}));
