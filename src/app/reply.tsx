import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { genderLabels } from '@/catalogs';
import { isRepositoryError, LIMITS, type AuthorView } from '@/contracts';
import { useCachedComment, useCachedPost, useCreateComment, useMyProfile } from '@/data/hooks';
import { useClock } from '@/data/RepositoryProvider';
import { newIdempotencyKey } from '@/features/access/steps';
import { Avatar } from '@/ui/components/Avatar';
import { AuthorRow } from '@/ui/components/AuthorRow';
import { PrimaryButton, SecondaryButton, TextButton } from '@/ui/components/buttons';
import { AppText } from '@/ui/components/Text';
import { formatRelative } from '@/ui/format';
import { strings } from '@/ui/strings';
import { useToast } from '@/ui/toast';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, spacing, typography } from '@/ui/theme/tokens';
import { createStyles } from '@/ui/theme/useStyles';

const nameOf = (author: AuthorView) =>
  author.view === 'member' ? author.name : genderLabels[author.gender];

/**
 * Ответ: a full-screen surface to write a reply to a post (a Комментарий) or to a
 * Комментарий (an Ответ). The text stays until the server confirms, and a retry after a
 * failure reuses the same key, so it is never published twice.
 */
export default function ReplyScreen() {
  const styles = useStyles();
  const router = useRouter();
  const clock = useClock();
  const { colors } = useTheme();
  const toast = useToast((s) => s.show);
  const params = useLocalSearchParams<{ postId: string; parentId?: string }>();
  const postId = String(params.postId);
  const parentId = params.parentId ? String(params.parentId) : undefined;
  const t = strings.reply;

  // Context comes from what the post screen already loaded: the surface makes no
  // request of its own before «Ответить», and the server checks the target on send.
  const post = useCachedPost(postId);
  const parent = useCachedComment(postId, parentId);
  const me = useMyProfile();
  const create = useCreateComment(postId);
  const [text, setText] = useState('');
  const [idempotencyKey, setKey] = useState(newIdempotencyKey);

  const leave = () => (router.canGoBack() ? router.back() : router.replace(`/post/${postId}`));
  const trimmed = text.trim();
  const canSend = trimmed.length > 0 && text.length <= LIMITS.commentText && !create.isPending;

  const send = () =>
    create.mutate(
      { parentId, text, idempotencyKey },
      {
        onSuccess: () => {
          setKey(newIdempotencyKey());
          toast(t.done);
          leave();
        },
      },
    );

  const errorText = (() => {
    if (!create.isError) return undefined;
    const error = create.error;
    if (isRepositoryError(error)) {
      const field = error.fieldErrors?.text ?? error.fieldErrors?.parentId;
      if (field && field in t.errors) return t.errors[field as keyof typeof t.errors];
      if (error.code === 'NOT_FOUND') return t.errors.gone;
    }
    return t.failed;
  })();

  const context = parent ?? post;
  const contextAuthor = context?.author;

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.root} testID="screen-reply">
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TextButton label={t.cancel} onPress={leave} testID="reply-cancel" />
          <AppText variant="bodyStrong" role="heading" style={styles.title} pointerEvents="none">
            {t.title}
          </AppText>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {context && contextAuthor ? (
            <View style={styles.context} testID="reply-context">
              <AppText variant="caption" tone="textMuted">
                {parent ? t.toComment(nameOf(parent.author)) : t.toPost}
              </AppText>
              <AuthorRow author={contextAuthor} time={formatRelative(context.createdAt, clock)} />
              <AppText numberOfLines={3} tone="textMuted">
                {context.text}
              </AppText>
            </View>
          ) : null}

          <View style={styles.compose}>
            {me.data ? <Avatar avatar={me.data.avatar} size={36} /> : null}
            <TextInput
              autoFocus
              multiline
              value={text}
              onChangeText={(value) => {
                setText(value);
                if (create.isError) create.reset();
              }}
              placeholder={t.placeholder}
              placeholderTextColor={colors.textMuted}
              maxLength={LIMITS.commentText}
              aria-label={t.label}
              aria-invalid={!!errorText}
              editable={!create.isPending}
              style={styles.input}
              testID="reply-input"
            />
          </View>
        </ScrollView>

        <View style={styles.footer}>
          {errorText ? (
            <AppText tone="danger" role="alert" testID="reply-error">
              {errorText}
            </AppText>
          ) : null}
          <View style={styles.footerRow}>
            <AppText variant="caption" tone="textMuted" testID="reply-counter">
              {`${text.length} / ${LIMITS.commentText}`}
            </AppText>
            {create.isPending ? (
              <AppText variant="caption" tone="textMuted" role="status" testID="reply-sending">
                {t.sending}
              </AppText>
            ) : null}
          </View>
          {create.isError && trimmed ? (
            <SecondaryButton label={t.retry} onPress={send} testID="reply-retry" />
          ) : (
            <PrimaryButton
              label={t.submit}
              disabled={!canSend}
              loading={create.isPending}
              onPress={send}
              testID="reply-submit"
            />
          )}
        </View>
      </KeyboardAvoidingView>
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
  compose: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  input: {
    ...typography.body,
    flex: 1,
    minHeight: 120,
    color: colors.text,
    textAlignVertical: 'top',
    paddingTop: spacing.xs,
    // A borderless writing field: the caret shows focus, not the browser's outline box.
    outlineStyle: 'solid',
    outlineWidth: 0,
  },
  footer: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.bg,
  },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between' },
}));
