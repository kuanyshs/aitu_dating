import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { settlementName } from '@/catalogs';
import { isRepositoryError, LIMITS, type AuthorView } from '@/contracts';
import { useSession, useShareMeeting, useShareRecipients } from '@/data/hooks';
import { newIdempotencyKey } from '@/features/access/steps';
import { AccessPrompt } from '@/ui/components/AccessPrompt';
import { Avatar } from '@/ui/components/Avatar';
import { FeedSkeleton } from '@/ui/components/FeedSkeleton';
import { Screen } from '@/ui/components/Screen';
import { SheetHeader } from '@/ui/components/SheetHeader';
import { TextArea } from '@/ui/components/TextArea';
import { AppText } from '@/ui/components/Text';
import { strings } from '@/ui/strings';
import { useToast } from '@/ui/toast';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { minTouch, radius, spacing, typography } from '@/ui/theme/tokens';
import { createStyles } from '@/ui/theme/useStyles';

const t = strings.share;

/**
 * «Поделиться встречей»: find someone one may write to and send the Встреча into the
 * pair's one chat, with a note if wanted. One tap is one message.
 */
export default function ShareMeetingScreen() {
  const styles = useStyles();
  const router = useRouter();
  const { colors } = useTheme();
  const toast = useToast((s) => s.show);
  const { planId } = useLocalSearchParams<{ planId?: string }>();
  const session = useSession();
  const active = session.data?.accessState === 'ACTIVE_MEMBER';
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const recipients = useShareRecipients(text.trim(), active);
  const share = useShareMeeting();

  if (session.data && !active) {
    return (
      <Screen testID="screen-share-meeting" withTabBar={false}>
        <AccessPrompt text={strings.chat.guest} testID="share-access-prompt" />
      </Screen>
    );
  }

  const send = (person: AuthorView) => {
    if (!planId || person.view !== 'member' || share.isPending) return;
    share.mutate(
      {
        planId: String(planId),
        memberId: person.id,
        ...(note.trim() ? { message: note.trim() } : {}),
        idempotencyKey: newIdempotencyKey(),
      },
      {
        onSuccess: (message) => {
          toast(t.sent);
          router.replace(`/chats/${message.chatId}`);
        },
        onError: (error) =>
          toast(
            isRepositoryError(error) && error.fieldErrors?.memberId === 'self' ? t.self : t.failed,
          ),
      },
    );
  };

  const items = recipients.data?.items ?? [];
  return (
    <Screen testID="screen-share-meeting" withTabBar={false}>
      <SheetHeader title={t.screenTitle} closeLabel={t.close} testID="share-close" />
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={t.search}
        placeholderTextColor={colors.textMuted}
        aria-label={t.search}
        style={styles.search}
        testID="share-search"
      />
      <TextArea
        label={t.note}
        value={note}
        onChangeText={setNote}
        maxLength={LIMITS.messageText}
        testID="share-note"
      />
      {recipients.isPending ? (
        <FeedSkeleton rows={2} />
      ) : items.length === 0 ? (
        <AppText tone="textMuted" testID="share-nobody">
          {t.nobody}
        </AppText>
      ) : (
        <View style={styles.list} testID="share-recipients">
          {items.map((person) =>
            person.view === 'member' ? (
              <Pressable
                key={person.id}
                role="button"
                aria-label={t.send(person.name)}
                onPress={() => send(person)}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                testID={`share-to-${person.id}`}
              >
                <Avatar avatar={person.avatar} size={40} />
                <View style={styles.grow}>
                  <AppText variant="bodyStrong">{person.name}</AppText>
                  {person.city ? (
                    <AppText variant="caption" tone="textMuted">
                      {settlementName(person.city) ?? ''}
                    </AppText>
                  ) : null}
                </View>
              </Pressable>
            ) : null,
          )}
        </View>
      )}
    </Screen>
  );
}

const useStyles = createStyles((colors) => ({
  search: {
    ...typography.body,
    minHeight: minTouch,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    color: colors.text,
  },
  list: { gap: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: minTouch,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  pressed: { backgroundColor: colors.surfacePressed },
  grow: { flex: 1 },
}));
