import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  isRepositoryError,
  LIMITS,
  ReportReason,
  ReportTarget,
  type AuthorView,
  type ReportReceipt,
} from '@/contracts';
import {
  useCachedCommentById,
  useCachedPost,
  useCachedProfile,
  useCreateReport,
  usePost,
  useSession,
  useSetBlock,
} from '@/data/hooks';
import { useClock } from '@/data/RepositoryProvider';
import { newIdempotencyKey } from '@/features/access/steps';
import { AuthorRow } from '@/ui/components/AuthorRow';
import { PrimaryButton, SecondaryButton, TextButton } from '@/ui/components/buttons';
import { RadioGroup } from '@/ui/components/RadioGroup';
import { TextArea } from '@/ui/components/TextArea';
import { AppText } from '@/ui/components/Text';
import { formatRelative } from '@/ui/format';
import { ShieldCheck } from '@/ui/icons';
import { useReportFooter } from '@/ui/navigation/statusInset';
import { strings } from '@/ui/strings';
import { useToast } from '@/ui/toast';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, spacing } from '@/ui/theme/tokens';
import { createStyles } from '@/ui/theme/useStyles';

const t = strings.report;
const reasonOptions = ReportReason.options.map((value) => ({ value, label: t.reasons[value] }));

/**
 * Жалоба: pick a reason, add details (required for «Другое») and send. What was entered
 * stays until the server confirms, and a retry reuses the same key, so a report is never
 * sent twice. Guests report too, anonymously.
 */
export default function ReportScreen() {
  const styles = useStyles();
  const router = useRouter();
  const params = useLocalSearchParams<{ targetType?: string; targetId?: string }>();
  const parsed = ReportTarget.safeParse({ type: params.targetType, id: params.targetId });
  const leave = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (!parsed.success) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={styles.root} testID="screen-report">
        <Header onCancel={leave} />
        <View style={styles.content}>
          <AppText tone="textMuted">{t.errors.gone}</AppText>
        </View>
      </SafeAreaView>
    );
  }
  return <ReportForm target={parsed.data} leave={leave} />;
}

function Header({ onCancel }: { onCancel?: () => void }) {
  const styles = useStyles();
  return (
    <View style={styles.header}>
      {onCancel ? <TextButton label={t.cancel} onPress={onCancel} testID="report-cancel" /> : null}
      <AppText variant="bodyStrong" role="heading" style={styles.title} pointerEvents="none">
        {t.title}
      </AppText>
    </View>
  );
}

function ReportForm({ target, leave }: { target: ReportTarget; leave: () => void }) {
  const styles = useStyles();
  const clock = useClock();
  const session = useSession();
  const create = useCreateReport();
  const reportFooter = useReportFooter();
  const [reason, setReason] = useState<ReportReason | undefined>();
  const [details, setDetails] = useState('');
  const [idempotencyKey] = useState(newIdempotencyKey);
  const [receipt, setReceipt] = useState<ReportReceipt>();

  // Context comes from what the feed or the post screen already loaded; a post opened
  // by a direct link is fetched. The server checks the target on send.
  const cachedPost = useCachedPost(target.type === 'post' ? target.id : '');
  const fetchedPost = usePost(target.id, { enabled: target.type === 'post' && !cachedPost });
  const post = target.type === 'post' ? (cachedPost ?? fetchedPost.data) : undefined;
  const comment = useCachedCommentById(target.type === 'comment' ? target.id : '');
  const context = post ?? comment;
  // A person reported from their profile, as that profile showed them.
  const person = useCachedProfile(target.type === 'user' ? target.id : '')?.person;
  const author = context?.author ?? person;

  const accessState = session.data?.accessState;
  // Members, expired ones too, may block the author afterwards; guests may not.
  const canBlock =
    !!author &&
    !context?.mine &&
    (accessState === 'ACTIVE_MEMBER' || accessState === 'ACTIVE_MEMBER_EXPIRED');

  if (receipt) {
    return (
      <Sent
        receipt={receipt}
        target={target}
        guest={accessState === 'GUEST_PREVIEW'}
        blockAuthor={canBlock ? author : undefined}
        onDone={leave}
      />
    );
  }

  const needsDetails = reason === 'other';
  const canSend = !!reason && (!needsDetails || details.trim().length > 0) && !create.isPending;
  const send = () => {
    if (!reason) return;
    create.mutate(
      { target, reason, details: details.trim() || undefined, idempotencyKey },
      { onSuccess: setReceipt },
    );
  };

  const fieldError = (() => {
    if (!create.isError || !isRepositoryError(create.error)) return undefined;
    const field = create.error.fieldErrors?.details;
    return field && field in t.errors ? t.errors[field as keyof typeof t.errors] : undefined;
  })();
  const errorText = (() => {
    if (!create.isError || fieldError) return undefined;
    const error = create.error;
    if (isRepositoryError(error)) {
      if (error.code === 'NOT_FOUND') return t.errors.gone;
      if (error.code === 'CONFLICT') return t.errors.own;
    }
    return t.failed;
  })();
  // A failed request is worth repeating as is; a refused one is not.
  const canRetry =
    create.isError &&
    !fieldError &&
    !(isRepositoryError(create.error) && ['NOT_FOUND', 'CONFLICT'].includes(create.error.code));

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.root} testID="screen-report">
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Header onCancel={leave} />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.context} testID="report-target">
            <AppText variant="caption" tone="textMuted">
              {t.about[target.type]}
            </AppText>
            {context ? (
              <>
                <AuthorRow
                  author={context.author}
                  time={formatRelative(context.createdAt, clock)}
                />
                <AppText numberOfLines={3} tone="textMuted">
                  {context.text}
                </AppText>
              </>
            ) : person ? (
              <AuthorRow author={person} />
            ) : null}
          </View>

          <View style={styles.section}>
            <AppText variant="bodyStrong">{t.reasonLabel}</AppText>
            <RadioGroup
              label={t.reasonLabel}
              options={reasonOptions}
              value={reason}
              onChange={(value) => {
                setReason(value);
                if (fieldError) create.reset();
              }}
              testID="report-reason"
            />
          </View>

          <TextArea
            label={t.detailsLabel}
            value={details}
            onChangeText={(value) => {
              setDetails(value);
              if (fieldError) create.reset();
            }}
            placeholder={needsDetails ? t.detailsRequired : t.detailsOptional}
            maxLength={LIMITS.reportDetails}
            error={fieldError}
            testID="report-details"
          />
        </ScrollView>

        <View style={styles.footer} onLayout={reportFooter}>
          {errorText ? (
            <AppText tone="danger" role="alert" testID="report-error">
              {errorText}
            </AppText>
          ) : null}
          {create.isPending ? (
            <AppText variant="caption" tone="textMuted" role="status" testID="report-sending">
              {t.sending}
            </AppText>
          ) : null}
          {canRetry ? (
            <SecondaryButton label={t.retry} onPress={send} testID="report-retry" />
          ) : (
            <PrimaryButton
              label={t.submit}
              disabled={!canSend || !!errorText}
              loading={create.isPending}
              onPress={send}
              testID="report-submit"
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** «Жалоба отправлена», or «Вы уже пожаловались» when one is already under review. */
function Sent({
  receipt,
  target,
  guest,
  blockAuthor,
  onDone,
}: {
  receipt: ReportReceipt;
  target: ReportTarget;
  guest: boolean;
  blockAuthor: AuthorView | undefined;
  onDone: () => void;
}) {
  const styles = useStyles();
  const router = useRouter();
  const { colors } = useTheme();
  const toast = useToast((s) => s.show);
  const setBlock = useSetBlock();
  const repeat = receipt.alreadyReported;
  const block = () => {
    if (target.type !== 'post' && target.type !== 'comment' && target.type !== 'user') return;
    setBlock.mutate(
      { target: { type: target.type, id: target.id }, active: true },
      {
        onSuccess: () => {
          toast(strings.block.done);
          // The author's post or profile is gone for the member now: its screen closes too.
          if (target.type !== 'comment') router.dismissTo('/');
          else onDone();
        },
        onError: () => toast(strings.block.failed),
      },
    );
  };
  const text = repeat ? t.repeatText : guest ? t.sentGuestText : t.sentText;
  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.root} testID="screen-report">
      <Header />
      <View style={styles.sent} testID={repeat ? 'report-repeat' : 'report-sent'}>
        <ShieldCheck size={48} color={colors.primary} aria-hidden />
        <AppText variant="title" role="heading" style={styles.center}>
          {repeat ? t.repeatTitle : t.sentTitle}
        </AppText>
        <AppText tone="textMuted" style={styles.center}>
          {text}
        </AppText>
      </View>
      <View style={styles.footer}>
        {blockAuthor ? (
          <>
            <AppText variant="caption" tone="textMuted" testID="report-block-hint">
              {strings.block.hint(blockAuthor.view === 'member' ? blockAuthor.name : undefined)}
            </AppText>
            <SecondaryButton
              label={t.blockAuthor}
              loading={setBlock.isPending}
              onPress={block}
              testID="report-block"
            />
          </>
        ) : null}
        <PrimaryButton label={t.done} onPress={onDone} testID="report-done" />
      </View>
    </SafeAreaView>
  );
}

const useStyles = createStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  // Centred on the screen, not between the buttons.
  title: { position: 'absolute', left: 0, right: 0, textAlign: 'center' },
  content: { padding: spacing.lg, gap: spacing.lg },
  context: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  section: { gap: spacing.sm },
  sent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  center: { textAlign: 'center' },
  footer: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.bg,
  },
}));
