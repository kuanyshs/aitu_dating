import { useRouter, type Href } from 'expo-router';
import { Pressable, View } from 'react-native';

import { AppText } from '@/ui/components/Text';
import { ChevronRight } from '@/ui/icons';
import { strings } from '@/ui/strings';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { minTouch, radius, spacing } from '@/ui/theme/tokens';
import { createStyles } from '@/ui/theme/useStyles';

const t = strings.profileSections;

type Props = {
  memberId: string;
  posts?: number;
  followers?: number;
  following?: number;
  unread: number;
  /** An expired member reads the lists of people only after renewing. */
  peopleLists: boolean;
};

/** The own profile's sections, in the order the product names them. */
export function ProfileSections({
  memberId,
  posts,
  followers,
  following,
  unread,
  peopleLists,
}: Props) {
  const styles = useStyles();
  const router = useRouter();
  const { colors } = useTheme();
  const count = (n: number | undefined) => (n === undefined ? undefined : String(n));
  const rows: {
    key: string;
    label: string;
    value?: string;
    to: Href;
    tab?: boolean;
    testID: string;
  }[] = [
    { key: 'edit', label: t.editCard, to: '/card-edit', testID: 'profile-edit-card' },
    {
      key: 'posts',
      label: t.posts,
      value: count(posts),
      to: '/my-posts',
      testID: 'profile-section-posts',
    },
    { key: 'plans', label: t.plans, to: '/my-plans', testID: 'profile-section-plans' },
    {
      key: 'responses',
      label: t.responses,
      to: { pathname: '/my-plans', params: { tab: 'responses' } },
      testID: 'profile-section-responses',
    },
    ...(peopleLists
      ? [
          {
            key: 'followers',
            label: t.followers,
            value: count(followers),
            to: { pathname: '/follows', params: { memberId, tab: 'followers' } } as Href,
            testID: 'profile-section-followers',
          },
          {
            key: 'following',
            label: t.following,
            value: count(following),
            to: { pathname: '/follows', params: { memberId, tab: 'following' } } as Href,
            testID: 'profile-section-following',
          },
        ]
      : []),
    { key: 'actions', label: t.actions, to: '/my-actions', testID: 'profile-section-actions' },
    {
      key: 'activity',
      label: t.activity,
      to: '/activity',
      tab: true,
      testID: 'profile-section-activity',
    },
    {
      key: 'messages',
      label: t.messages,
      value: unread ? (unread > 99 ? '99+' : String(unread)) : undefined,
      to: '/chats',
      tab: true,
      testID: 'profile-messages',
    },
    { key: 'settings', label: t.settings, to: '/settings', testID: 'open-settings' },
  ];
  return (
    <View role="list" aria-label={t.label} style={styles.list} testID="profile-sections">
      {rows.map((row, index) => (
        <Pressable
          key={row.key}
          role="link"
          aria-label={row.value ? `${row.label}: ${row.value}` : row.label}
          // Tabs are switched to, not stacked on top of the profile.
          onPress={() => (row.tab ? router.navigate(row.to) : router.push(row.to))}
          style={({ pressed }) => [
            styles.row,
            index > 0 && styles.divided,
            pressed && styles.pressed,
          ]}
          testID={row.testID}
        >
          <AppText style={styles.label}>{row.label}</AppText>
          {row.value ? (
            <AppText tone="textMuted" testID={`${row.testID}-count`}>
              {row.value}
            </AppText>
          ) : null}
          <ChevronRight size={18} color={colors.textMuted} />
        </Pressable>
      ))}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  list: { borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: minTouch + 4,
    paddingHorizontal: spacing.md,
  },
  divided: { borderTopWidth: 1, borderTopColor: colors.line },
  pressed: { backgroundColor: colors.surfacePressed },
  label: { flex: 1 },
}));
