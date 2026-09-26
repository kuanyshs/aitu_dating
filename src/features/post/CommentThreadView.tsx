import { memo } from 'react';
import { View } from 'react-native';

import type { Clock } from '@/clock';
import type { CommentThread, CommentView } from '@/contracts';
import { spacing } from '@/ui/theme/tokens';
import { createStyles } from '@/ui/theme/useStyles';

import { CommentRow, type CommentAction } from './CommentRow';

type Props = {
  thread: CommentThread;
  clock: Clock;
  onAction: (action: CommentAction, comment: CommentView) => void;
};

/** A Комментарий with its Ответы under a thin rail; the rail is decoration only. */
export const CommentThreadView = memo(function CommentThreadView({
  thread,
  clock,
  onAction,
}: Props) {
  const styles = useStyles();
  return (
    <View style={styles.thread} testID="comment-thread">
      <CommentRow comment={thread.comment} clock={clock} onAction={onAction} canReply />
      {thread.replies.length > 0 ? (
        <View style={styles.replies}>
          <View style={styles.rail} aria-hidden />
          <View style={styles.replyList}>
            {thread.replies.map((reply) => (
              <CommentRow
                key={reply.id}
                comment={reply}
                clock={clock}
                onAction={onAction}
                canReply={false}
              />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
});

const useStyles = createStyles((colors) => ({
  thread: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  replies: { flexDirection: 'row' },
  // Centred under the 32px root avatar.
  rail: { width: 2, marginLeft: 15, marginRight: spacing.lg, backgroundColor: colors.line },
  replyList: { flex: 1 },
}));
