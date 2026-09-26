import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { View } from 'react-native';

import {
  cityLabels,
  communicationStyleLabels,
  datingIntentLabels,
  interestLabels,
  questionKeys,
  questionLabels,
  questionOptionLabels,
  type QuestionKey,
} from '@/catalogs';
import type { MyProfile } from '@/contracts';
import { BadgeCheck } from '@/ui/icons';
import { strings } from '@/ui/strings';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, spacing } from '@/ui/theme/tokens';
import { createStyles } from '@/ui/theme/useStyles';

import { Avatar } from './Avatar';
import { AppText } from './Text';

function answerLabel(question: QuestionKey, answer: string): string {
  if (question === 'city') return cityLabels[answer as keyof typeof cityLabels];
  if (question === 'intent') return datingIntentLabels[answer as keyof typeof datingIntentLabels];
  return questionOptionLabels[answer] ?? answer;
}

/** The member's own Карточка: Passport identity on top, then what they wrote about themselves. */
export function ProfileCardView({ me }: { me: MyProfile }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const t = strings.profile;
  const until = format(new Date(me.membership.endsAt), 'd MMMM yyyy', { locale: ru });
  const membershipText =
    me.membership.status === 'expired'
      ? t.membershipExpired
      : me.membership.tier === 'free_verified'
        ? t.membershipFree(until)
        : t.membershipActive(until);

  return (
    <View style={styles.root} testID="profile-card">
      <View style={styles.header}>
        <View style={styles.identity}>
          <View style={styles.nameRow}>
            <AppText variant="display" role="heading" testID="profile-name">
              {me.name}
            </AppText>
            {me.verified ? (
              <BadgeCheck size={22} color={colors.text} strokeWidth={2} aria-label={t.verified} />
            ) : null}
          </View>
          <AppText tone="textMuted">{t.ageCity(me.age, cityLabels[me.city])}</AppText>
        </View>
        <Avatar avatar={me.avatar} size={72} />
      </View>

      <AppText testID="profile-bio-text">{me.card.bio}</AppText>

      <View style={styles.membership} testID="profile-membership">
        <AppText variant="caption">{membershipText}</AppText>
      </View>

      <Section title={t.intent}>
        <AppText>{datingIntentLabels[me.card.intent]}</AppText>
      </Section>

      <Section title={t.interests}>
        <View style={styles.tags}>
          {me.card.interests.map((key) => (
            <View key={key} style={styles.tag}>
              <AppText variant="caption">{interestLabels[key]}</AppText>
            </View>
          ))}
        </View>
      </Section>

      <Section title={t.communication}>
        <AppText>{communicationStyleLabels[me.card.communicationStyle]}</AppText>
      </Section>

      <Section title={t.questionnaire}>
        <View style={{ gap: spacing.md }}>
          {questionKeys.map((key) => (
            <View key={key} style={{ gap: 2 }}>
              <AppText variant="caption" tone="textMuted">
                {questionLabels[key]}
              </AppText>
              <AppText>{answerLabel(key, me.card.questionnaire[key])}</AppText>
            </View>
          ))}
        </View>
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
  root: { gap: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  identity: { flex: 1, gap: spacing.xs },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  membership: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
  },
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
