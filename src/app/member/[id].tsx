import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import {
  cityLabels,
  communicationStyleLabels,
  datingIntentLabels,
  genderLabels,
  interestLabels,
} from '@/catalogs';
import { isRepositoryError, type ProfileView } from '@/contracts';
import { useProfile, useSession, useSetBlock, useSetFollow } from '@/data/hooks';
import { MyPosts } from '@/features/profile/MyPosts';
import { AccessPrompt } from '@/ui/components/AccessPrompt';
import { ActionSheet, type SheetAction } from '@/ui/components/ActionSheet';
import { Avatar } from '@/ui/components/Avatar';
import { IconAction, PrimaryButton, SecondaryButton } from '@/ui/components/buttons';
import { FeedSkeleton } from '@/ui/components/FeedSkeleton';
import { Screen } from '@/ui/components/Screen';
import { EmptyState, ErrorState } from '@/ui/components/StateViews';
import { AppText } from '@/ui/components/Text';
import { BadgeCheck, ChevronLeft, Ellipsis } from '@/ui/icons';
import { strings } from '@/ui/strings';
import { useToast } from '@/ui/toast';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, spacing } from '@/ui/theme/tokens';
import { createStyles } from '@/ui/theme/useStyles';

const t = strings.member;

/**
 * Another member's profile. Active members see them in full with their Карточка and may
 * follow; an expired member sees the safe view and is offered Продление. Someone hidden
 * from the viewer (Блокировка, Ограничение) reads «Профиль недоступен».
 */
export default function MemberScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const memberId = String(id);
  const session = useSession();
  const state = session.data?.accessState;
  const isMember = state === 'ACTIVE_MEMBER' || state === 'ACTIVE_MEMBER_EXPIRED';
  const profile = useProfile(memberId, { enabled: isMember && session.data?.userId !== memberId });

  if (!session.data)
    return (
      <Screen testID="screen-member" withTabBar={false}>
        {null}
      </Screen>
    );
  // One's own profile lives on the Profile tab.
  if (session.data.userId === memberId) return <Redirect href="/profile" />;
  if (!isMember) {
    return (
      <Screen testID="screen-member" withTabBar={false}>
        <Header />
        <AccessPrompt text={strings.access.prompt.member} testID="member-access-prompt" />
      </Screen>
    );
  }
  return <MemberProfile memberId={memberId} profile={profile} />;
}

function Header({ onMenu }: { onMenu?: () => void }) {
  const styles = useStyles();
  const router = useRouter();
  return (
    <View style={styles.header}>
      <IconAction
        icon={ChevronLeft}
        accessibilityLabel={t.back}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        testID="member-back"
      />
      {onMenu ? (
        <IconAction
          icon={Ellipsis}
          accessibilityLabel={t.menu}
          onPress={onMenu}
          testID="member-menu"
        />
      ) : null}
    </View>
  );
}

type Sheet = 'menu' | 'block';

function MemberProfile({
  memberId,
  profile,
}: {
  memberId: string;
  profile: ReturnType<typeof useProfile>;
}) {
  const styles = useStyles();
  const router = useRouter();
  const toast = useToast((s) => s.show);
  const setBlock = useSetBlock();
  const [sheet, setSheet] = useState<Sheet>();
  const leave = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (isRepositoryError(profile.error) && profile.error.code === 'NOT_FOUND') {
    return (
      <Screen testID="screen-member" withTabBar={false}>
        <Header />
        <EmptyState
          testID="member-unavailable"
          title={t.unavailableTitle}
          text={t.unavailableText}
          action={{ label: t.back, onPress: leave, testID: 'member-unavailable-back' }}
        />
      </Screen>
    );
  }
  if (!profile.data) {
    return (
      <Screen testID="screen-member" withTabBar={false}>
        <Header />
        {profile.isError ? (
          <ErrorState
            testID="member-error"
            title={t.errorTitle}
            text={t.errorText}
            action={{ label: t.retry, onPress: () => profile.refetch(), testID: 'member-retry' }}
          />
        ) : (
          <FeedSkeleton rows={2} />
        )}
      </Screen>
    );
  }

  const data = profile.data;
  const person = data.person;
  const name = person.view === 'member' ? person.name : undefined;
  const block = () => {
    setSheet(undefined);
    setBlock.mutate(
      { target: { type: 'user', id: memberId }, active: true },
      {
        onSuccess: () => {
          toast(strings.block.done);
          leave();
        },
        onError: () => toast(strings.block.failed),
      },
    );
  };
  const actions: SheetAction[] =
    sheet === 'block'
      ? [
          {
            label: strings.block.confirm,
            danger: true,
            onPress: block,
            testID: 'sheet-confirm-block',
          },
        ]
      : [
          {
            label: t.report,
            onPress: () => {
              setSheet(undefined);
              router.push({
                pathname: '/report',
                params: { targetType: 'user', targetId: memberId },
              });
            },
            testID: 'sheet-report',
          },
          { label: t.block, onPress: () => setSheet('block'), testID: 'sheet-block' },
        ];

  return (
    <Screen testID="screen-member" withTabBar={false}>
      <Header onMenu={() => setSheet('menu')} />
      <Identity profile={data} />
      <Stats profile={data} />
      {data.relation ? (
        <FollowButton memberId={memberId} relation={data.relation} />
      ) : (
        <View style={styles.safe}>
          <AppText tone="textMuted">{t.safeHint}</AppText>
          <SecondaryButton
            label={t.renew}
            onPress={() => router.push('/renew')}
            testID="member-renew"
          />
        </View>
      )}
      {data.card ? <Card card={data.card} /> : null}
      <MyPosts memberId={memberId} canWrite={false} other />
      <ActionSheet
        visible={!!sheet}
        title={sheet === 'block' ? strings.block.title : undefined}
        message={sheet === 'block' ? strings.block.hint(name) : undefined}
        actions={actions}
        onClose={() => setSheet(undefined)}
        testID="member-sheet"
      />
    </Screen>
  );
}

function Identity({ profile }: { profile: ProfileView }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const person = profile.person;
  return (
    <View style={styles.identity} testID="member-identity">
      <Avatar avatar={person.avatar} size={72} />
      <View style={styles.grow}>
        <View style={styles.nameRow}>
          <AppText variant="display" role="heading" testID="member-name">
            {person.view === 'member' ? person.name : genderLabels[person.gender]}
          </AppText>
          {person.view === 'member' && person.verified ? (
            <BadgeCheck
              size={22}
              color={colors.text}
              strokeWidth={2}
              aria-label={strings.profile.verified}
            />
          ) : null}
        </View>
        <AppText tone="textMuted">
          {strings.profile.ageCity(person.age, cityLabels[person.city])}
        </AppText>
      </View>
    </View>
  );
}

function Stats({ profile }: { profile: ProfileView }) {
  const styles = useStyles();
  const items = [
    ['posts', profile.stats.posts],
    ['followers', profile.stats.followers],
    ['following', profile.stats.following],
  ] as const;
  return (
    <View style={styles.stats}>
      {items.map(([key, value]) => (
        <View key={key} style={styles.stat} testID={`member-stat-${key}`}>
          <AppText variant="title">{String(value)}</AppText>
          <AppText variant="caption" tone="textMuted">
            {t.stats[key]}
          </AppText>
        </View>
      ))}
    </View>
  );
}

function FollowButton({
  memberId,
  relation,
}: {
  memberId: string;
  relation: NonNullable<ProfileView['relation']>;
}) {
  const styles = useStyles();
  const toast = useToast((s) => s.show);
  const follow = useSetFollow();
  const toggle = () =>
    follow.mutate(
      { memberId, active: !relation.following },
      { onError: () => toast(t.followFailed) },
    );
  return (
    <View style={styles.follow}>
      {relation.following ? (
        <SecondaryButton label={t.following} onPress={toggle} testID="member-follow" />
      ) : (
        <PrimaryButton label={t.follow} onPress={toggle} testID="member-follow" />
      )}
      {relation.following && relation.followsMe ? (
        <View style={styles.badge} testID="member-mutual">
          <AppText variant="caption">{t.mutual}</AppText>
        </View>
      ) : null}
    </View>
  );
}

function Card({ card }: { card: NonNullable<ProfileView['card']> }) {
  const styles = useStyles();
  const p = strings.profile;
  return (
    <View style={styles.card} testID="member-card">
      {card.bio ? <AppText testID="member-bio">{card.bio}</AppText> : null}
      <Section title={p.intent}>
        <AppText>{datingIntentLabels[card.intent]}</AppText>
      </Section>
      <Section title={p.interests}>
        <View style={styles.tags}>
          {card.interests.map((key) => (
            <View key={key} style={styles.tag}>
              <AppText variant="caption">{interestLabels[key]}</AppText>
            </View>
          ))}
        </View>
      </Section>
      <Section title={p.communication}>
        <AppText>{communicationStyleLabels[card.communicationStyle]}</AppText>
      </Section>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.section}>
      <AppText variant="bodyStrong">{title}</AppText>
      {children}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  header: { flexDirection: 'row', justifyContent: 'space-between', marginLeft: -spacing.sm },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  grow: { flex: 1, gap: spacing.xs },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stats: {
    flexDirection: 'row',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  stat: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, gap: 2 },
  follow: { gap: spacing.sm },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  safe: { gap: spacing.sm },
  card: { gap: spacing.lg },
  section: {
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tag: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
}));
