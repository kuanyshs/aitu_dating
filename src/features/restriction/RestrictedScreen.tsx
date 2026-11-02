import { useState, type ComponentType } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LIMITS, type MyRestriction } from '@/contracts';
import { useCreateAppeal, useMyRestriction } from '@/data/hooks';
import { useClock } from '@/data/RepositoryProvider';
import { newIdempotencyKey } from '@/features/access/steps';
import { SupportForm } from '@/features/support/SupportForm';
import { demoToolsEnabled } from '@/demo/flags';
import { PrimaryButton, SecondaryButton } from '@/ui/components/buttons';
import { FeedSkeleton } from '@/ui/components/FeedSkeleton';
import { TextArea } from '@/ui/components/TextArea';
import { AppText } from '@/ui/components/Text';
import { formatDay } from '@/ui/format';
import { ShieldCheck } from '@/ui/icons';
import { strings } from '@/ui/strings';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, spacing } from '@/ui/theme/tokens';
import { createStyles } from '@/ui/theme/useStyles';

// The demo panel stays reachable here, otherwise a tester could never lift the restriction.
const DemoPanel: ComponentType | null = demoToolsEnabled
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@/demo/DemoPanel').DemoPanel
  : null;

const t = strings.restricted;

/**
 * Full-screen state for BLOCKED: the decision (why and until when), the one Апелляция,
 * the rules and support. Nothing else of the club is reachable.
 */
export function RestrictedScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const restriction = useMyRestriction(true);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.root} testID="screen-restricted">
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ShieldCheck size={36} color={colors.text} strokeWidth={1.75} />
        <AppText variant="display" role="heading">
          {t.title}
        </AppText>
        <AppText tone="textMuted">{t.text}</AppText>

        {restriction.data ? (
          <>
            <Decision restriction={restriction.data} />
            <Appeal restriction={restriction.data} />
          </>
        ) : restriction.isPending ? (
          <FeedSkeleton rows={1} />
        ) : null}

        <View style={styles.section}>
          <AppText variant="title" role="heading">
            {t.rulesTitle}
          </AppText>
          {strings.access.rules.items.map((rule) => (
            <AppText key={rule}>{`• ${rule}`}</AppText>
          ))}
        </View>

        <View style={styles.section}>
          <AppText variant="title" role="heading">
            {t.supportTitle}
          </AppText>
          <AppText tone="textMuted">{t.supportText}</AppText>
          <SupportForm initialTopic="restriction" testID="restricted-support" />
        </View>

        {DemoPanel ? (
          <View style={styles.demo}>
            <DemoPanel />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Decision({ restriction }: { restriction: MyRestriction }) {
  const styles = useStyles();
  const clock = useClock();
  return (
    <View style={styles.section} testID="restricted-decision">
      <AppText variant="title" role="heading">
        {t.decisionTitle}
      </AppText>
      <AppText testID="restricted-reason">
        {t.reason(strings.report.reasons[restriction.reason])}
      </AppText>
      <AppText variant="bodyStrong" testID="restricted-until">
        {restriction.endsAt ? t.until(formatDay(restriction.endsAt, clock)) : t.permanent}
      </AppText>
      <AppText variant="caption" tone="textMuted">
        {t.decidedAt(formatDay(restriction.decidedAt, clock))}
      </AppText>
    </View>
  );
}

/** «Подать апелляцию» once, within 7 days; afterwards its status stays here. */
function Appeal({ restriction }: { restriction: MyRestriction }) {
  const styles = useStyles();
  const clock = useClock();
  const create = useCreateAppeal();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [idempotencyKey] = useState(newIdempotencyKey);
  const appeal = restriction.appeal;

  let body: React.ReactNode;
  if (appeal) {
    body = (
      <>
        <AppText variant="bodyStrong" testID="restricted-appeal-status">
          {t.appealStatus[appeal.status]}
        </AppText>
        <AppText variant="caption" tone="textMuted">
          {t.appealSentAt(formatDay(appeal.createdAt, clock))}
        </AppText>
      </>
    );
  } else if (!restriction.canAppeal) {
    body = (
      <AppText tone="textMuted" testID="restricted-appeal-closed">
        {t.appealClosed}
      </AppText>
    );
  } else if (!open) {
    body = (
      <>
        <AppText tone="textMuted">
          {t.appealText(formatDay(restriction.appealUntil, clock))}
        </AppText>
        <PrimaryButton
          label={t.appealOpen}
          onPress={() => setOpen(true)}
          testID="restricted-appeal-open"
        />
      </>
    );
  } else {
    body = (
      <>
        <TextArea
          label={t.appealLabel}
          value={text}
          onChangeText={(value) => {
            setText(value);
            if (create.isError) create.reset();
          }}
          placeholder={t.appealPlaceholder}
          maxLength={LIMITS.appealText}
          testID="restricted-appeal-text"
        />
        {create.isError ? (
          <AppText tone="danger" role="alert" testID="restricted-appeal-error">
            {t.appealFailed}
          </AppText>
        ) : null}
        <PrimaryButton
          label={t.appealSend}
          disabled={text.trim().length === 0}
          loading={create.isPending}
          // The same key on a retry: the Апелляция is created once.
          onPress={() => create.mutate({ text: text.trim(), idempotencyKey })}
          testID="restricted-appeal-send"
        />
        <SecondaryButton
          label={t.appealCancel}
          onPress={() => setOpen(false)}
          testID="restricted-appeal-cancel"
        />
      </>
    );
  }

  return (
    <View style={styles.section} testID="restricted-appeal">
      <AppText variant="title" role="heading">
        {t.appealTitle}
      </AppText>
      {body}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.md },
  section: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  demo: { marginTop: spacing.lg },
}));
