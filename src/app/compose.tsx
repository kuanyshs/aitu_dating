import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { topicLabels, topics as topicKeys, type Topic } from '@/catalogs';
import { isRepositoryError, LIMITS } from '@/contracts';
import { useCachedPost, useCreatePost, useMyProfile, usePost, useSession } from '@/data/hooks';
import { useClock } from '@/data/RepositoryProvider';
import { newIdempotencyKey } from '@/features/access/steps';
import { AccessPrompt } from '@/ui/components/AccessPrompt';
import { Avatar } from '@/ui/components/Avatar';
import { AuthorRow } from '@/ui/components/AuthorRow';
import { PrimaryButton, SecondaryButton, TextButton } from '@/ui/components/buttons';
import { Chip } from '@/ui/components/Chip';
import { Screen } from '@/ui/components/Screen';
import { AppText } from '@/ui/components/Text';
import { formatRelative } from '@/ui/format';
import { strings } from '@/ui/strings';
import { useToast } from '@/ui/toast';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, spacing, typography } from '@/ui/theme/tokens';
import { createStyles } from '@/ui/theme/useStyles';

type Kind = 'post' | 'question';
const kinds: Kind[] = ['post', 'question'];
const MAX_TOPICS = 4;

/**
 * Создание: one full-screen editor for a Пост, a Вопрос or a Цитата. The text stays
 * until the server confirms, and a retry after a failure reuses the same key, so the
 * post is never published twice.
 */
export default function ComposeScreen() {
  const session = useSession();
  if (session.data && session.data.accessState !== 'ACTIVE_MEMBER') {
    return (
      <Screen testID="screen-compose" withTabBar={false}>
        <AccessPrompt text={strings.access.prompt.create} testID="compose-access-prompt" />
      </Screen>
    );
  }
  return <Editor />;
}

function Editor() {
  const styles = useStyles();
  const router = useRouter();
  const clock = useClock();
  const { colors } = useTheme();
  const toast = useToast((s) => s.show);
  const t = strings.compose;
  const params = useLocalSearchParams<{ quote?: string }>();
  const quotedPostId = params.quote ? String(params.quote) : undefined;
  // The card comes from what the feed or the post screen already loaded; a direct link
  // fetches it. A quoted post that is gone cannot be quoted.
  const cachedQuote = useCachedPost(quotedPostId ?? '');
  const fetchedQuote = usePost(quotedPostId ?? '', { enabled: !!quotedPostId && !cachedQuote });
  const quoted = cachedQuote ?? fetchedQuote.data;
  const quoteGone =
    !!quotedPostId &&
    isRepositoryError(fetchedQuote.error) &&
    fetchedQuote.error.code === 'NOT_FOUND';
  const me = useMyProfile();
  const create = useCreatePost();

  const [kind, setKind] = useState<Kind>('post');
  const [topics, setTopics] = useState<Topic[]>([]);
  const [text, setText] = useState('');
  const [idempotencyKey, setKey] = useState(newIdempotencyKey);
  const type = quotedPostId ? 'quote' : kind;

  const leave = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const trimmed = text.trim();
  const canSend =
    trimmed.length > 0 && text.length <= LIMITS.postText && !create.isPending && !quoteGone;

  // Any change after a failure is a new attempt at a different post.
  const edit = () => {
    if (!create.isError) return;
    create.reset();
    setKey(newIdempotencyKey());
  };

  const toggleTopic = (topic: Topic) => {
    edit();
    setTopics((current) =>
      current.includes(topic)
        ? current.filter((t) => t !== topic)
        : current.length < MAX_TOPICS
          ? [...current, topic]
          : current,
    );
  };

  const send = () =>
    create.mutate(
      { type, text, topics, idempotencyKey, ...(quotedPostId ? { quotedPostId } : {}) },
      {
        onSuccess: () => {
          toast(t.done);
          // Back to Home, closing whatever the editor was opened over (a post screen too).
          router.dismissTo({ pathname: '/', params: { feed: 'for_you' } });
        },
      },
    );

  const errorText = (() => {
    if (quoteGone) return t.errors.gone;
    if (!create.isError) return undefined;
    const error = create.error;
    if (isRepositoryError(error)) {
      const field = error.fieldErrors?.text ?? error.fieldErrors?.topics;
      if (field && field in t.errors) return t.errors[field as keyof typeof t.errors];
      if (error.code === 'NOT_FOUND') return t.errors.gone;
    }
    return t.failed;
  })();

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.root} testID="screen-compose">
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TextButton label={t.cancel} onPress={leave} testID="compose-cancel" />
          <AppText variant="bodyStrong" role="heading" style={styles.title} pointerEvents="none">
            {t.title[type]}
          </AppText>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {quotedPostId ? null : (
            <View role="radiogroup" aria-label={t.typeLabel} style={styles.chips}>
              {kinds.map((k) => (
                <Chip
                  key={k}
                  label={t.type[k]}
                  selected={k === kind}
                  onPress={() => {
                    edit();
                    setKind(k);
                  }}
                  testID={`compose-type-${k}`}
                />
              ))}
              <Chip
                label={t.type.plan}
                selected={false}
                onPress={() => router.push('/plan/new')}
                testID="compose-type-plan"
              />
            </View>
          )}

          <View style={styles.compose}>
            {/* The slot is kept while the card loads, so the text never jumps sideways. */}
            <View style={styles.avatar}>
              {me.data ? <Avatar avatar={me.data.avatar} size={36} /> : null}
            </View>
            <TextInput
              autoFocus
              multiline
              value={text}
              onChangeText={(value) => {
                edit();
                setText(value);
              }}
              placeholder={t.placeholder[type]}
              placeholderTextColor={colors.textMuted}
              maxLength={LIMITS.postText}
              aria-label={t.label}
              aria-invalid={!!errorText}
              editable={!create.isPending}
              style={styles.input}
              testID="compose-input"
            />
          </View>

          {quotedPostId && quoted ? (
            <View
              style={styles.quoted}
              aria-label={t.quoted}
              testID={`compose-quoted-${quoted.id}`}
            >
              <AuthorRow author={quoted.author} time={formatRelative(quoted.createdAt, clock)} />
              <AppText numberOfLines={3}>{quoted.text}</AppText>
            </View>
          ) : quoteGone ? (
            <View style={styles.quoted} testID="compose-quoted-unavailable">
              <AppText tone="textMuted">{strings.post.quoteUnavailable}</AppText>
            </View>
          ) : null}

          <View role="group" aria-label={t.topicsLabel} style={styles.chips}>
            {topicKeys.map((topic) => (
              <Chip
                key={topic}
                role="checkbox"
                label={`#${topicLabels[topic]}`}
                selected={topics.includes(topic)}
                disabled={!topics.includes(topic) && topics.length >= MAX_TOPICS}
                onPress={() => toggleTopic(topic)}
                testID={`compose-topic-${topic}`}
              />
            ))}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          {errorText ? (
            <AppText tone="danger" role="alert" testID="compose-error">
              {errorText}
            </AppText>
          ) : null}
          <View style={styles.footerRow}>
            <AppText variant="caption" tone="textMuted" testID="compose-counter">
              {`${text.length} / ${LIMITS.postText}`}
            </AppText>
            {create.isPending ? (
              <AppText variant="caption" tone="textMuted" role="status" testID="compose-sending">
                {t.sending}
              </AppText>
            ) : null}
          </View>
          {create.isError && trimmed ? (
            <SecondaryButton label={t.retry} onPress={send} testID="compose-retry" />
          ) : (
            <PrimaryButton
              label={t.submit}
              disabled={!canSend}
              loading={create.isPending}
              onPress={send}
              testID="compose-submit"
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  compose: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  avatar: { width: 36, height: 36 },
  input: {
    ...typography.body,
    flex: 1,
    minHeight: 140,
    color: colors.text,
    textAlignVertical: 'top',
    paddingTop: spacing.xs,
    // A borderless writing field: the caret shows focus, not the browser's outline box.
    outlineStyle: 'solid',
    outlineWidth: 0,
  },
  quoted: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
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
