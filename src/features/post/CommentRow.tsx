import { memo } from 'react';
import { Pressable, View } from 'react-native';

import type { Clock } from '@/clock';
import type { AuthorView, CommentView } from '@/contracts';
import { Avatar } from '@/ui/components/Avatar';
import { AuthorRow } from '@/ui/components/AuthorRow';
import { AppText } from '@/ui/components/Text';
import { formatRelative } from '@/ui/format';
import { Ellipsis, Heart } from '@/ui/icons';
import { strings } from '@/ui/strings';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { iconStroke, minTouch, spacing } from '@/ui/theme/tokens';
import { createStyles } from '@/ui/theme/useStyles';

export type CommentAction = 'like' | 'reply' | 'menu' | 'author';

type Props = {
  comment: CommentView;
  clock: Clock;
  onAction: (action: CommentAction, comment: CommentView) => void;
  /** Only a Комментарий can be answered; an Ответ is the last level. */
  canReply: boolean;
};

const authorName = (author: AuthorView) => (author.view === 'member' ? author.name : undefined);

/**
 * One Комментарий or Ответ; a deleted one keeps its place with «Комментарий удалён», one
 * hidden by a Блокировка with «Комментарий скрыт».
 */
export const CommentRow = memo(function CommentRow({ comment, clock, onAction, canReply }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const t = strings.postDetail;

  // Deleted by its author, or hidden by a Блокировка: only its place in the thread stays.
  if (comment.deleted || comment.hidden) {
    return (
      <View style={styles.row} testID={`comment-${comment.id}`}>
        <View style={styles.avatarGap} />
        <AppText
          tone="textMuted"
          style={styles.deleted}
          testID={comment.hidden ? 'comment-hidden' : 'comment-deleted'}
        >
          {comment.hidden ? t.hidden : t.deleted}
        </AppText>
      </View>
    );
  }

  const name = authorName(comment.author);
  return (
    <View style={styles.row} testID={`comment-${comment.id}`} role="article">
      <Avatar avatar={comment.author.avatar} size={32} />
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.author}>
            {/* Only the full view carries an id; a safe author cannot be opened. */}
            {name ? (
              <Pressable
                role="link"
                aria-label={strings.post.openAuthor(name)}
                onPress={() => onAction('author', comment)}
                testID="comment-author"
              >
                <AuthorRow
                  author={comment.author}
                  time={formatRelative(comment.createdAt, clock)}
                />
              </Pressable>
            ) : (
              <AuthorRow author={comment.author} time={formatRelative(comment.createdAt, clock)} />
            )}
          </View>
          {/* Own comments can be deleted; anyone else's reported or their author blocked. */}
          <Pressable
            role="button"
            aria-label={strings.deletion.commentMenu}
            onPress={() => onAction('menu', comment)}
            style={({ pressed }) => [styles.menu, pressed && styles.pressed]}
            testID="comment-menu"
          >
            <Ellipsis size={18} color={colors.textMuted} strokeWidth={iconStroke.default} />
          </Pressable>
        </View>
        <AppText testID="comment-text">{comment.text}</AppText>
        <View style={styles.actions}>
          <Pressable
            role="button"
            aria-label={t.like(comment.reactions)}
            aria-pressed={comment.reactedByMe}
            onPress={() => onAction('like', comment)}
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}
            testID="comment-like"
          >
            <Heart
              size={18}
              color={colors.textMuted}
              fill={comment.reactedByMe ? colors.textMuted : 'none'}
              strokeWidth={iconStroke.default}
            />
            {comment.reactions > 0 ? (
              <AppText variant="caption" tone="textMuted">
                {String(comment.reactions)}
              </AppText>
            ) : null}
          </Pressable>
          {canReply ? (
            <Pressable
              role="button"
              aria-label={name ? t.replyTo(name) : t.reply}
              onPress={() => onAction('reply', comment)}
              style={({ pressed }) => [styles.action, pressed && styles.pressed]}
              testID="comment-reply"
            >
              <AppText variant="caption" tone="textMuted">
                {t.reply}
              </AppText>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
});

const useStyles = createStyles((colors) => ({
  row: { flexDirection: 'row', gap: spacing.md, paddingTop: spacing.sm },
  avatarGap: { width: 32 },
  content: { flex: 1, gap: 2 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start' },
  author: { flex: 1, paddingTop: spacing.xs },
  menu: {
    width: minTouch,
    height: minTouch,
    marginTop: -spacing.sm,
    marginRight: -spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  deleted: { fontStyle: 'italic', paddingVertical: spacing.xs },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginLeft: -spacing.sm },
  action: {
    minWidth: minTouch,
    minHeight: minTouch,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: 999,
  },
  pressed: { backgroundColor: colors.surfacePressed },
}));
