import { memo, useState } from 'react';
import { Pressable, View } from 'react-native';

import {
  cityLabels,
  meetingFormatLabels,
  meetingGoalLabels,
  paymentPolicyLabels,
  topicLabels,
} from '@/catalogs';
import type { Clock } from '@/clock';
import type { PlanSummary, PostView } from '@/contracts';
import { formatPlanDate, formatRelative } from '@/ui/format';
import {
  Calendar,
  Clock as ClockIcon,
  Heart,
  MapPin,
  MessageCircle,
  Quote,
  Repeat2,
  Wallet,
  type Icon,
} from '@/ui/icons';
import { strings } from '@/ui/strings';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { iconStroke, minTouch, radius, spacing } from '@/ui/theme/tokens';
import { createStyles } from '@/ui/theme/useStyles';

import { Avatar } from './Avatar';
import { AuthorRow } from './AuthorRow';
import { SyntheticMedia } from './SyntheticMedia';
import { AppText } from './Text';

export type PostAction = 'comment' | 'reaction' | 'repost' | 'quote';

/** Surfaces a feed entry leads to: the post itself, its plan, or its author. */
export type PostTarget =
  { kind: 'post'; id: string } | { kind: 'plan'; id: string } | { kind: 'member'; id: string };

type Props = {
  post: PostView;
  clock: Clock;
  onAction: (action: PostAction, post: PostView) => void;
  onOpen: (target: PostTarget) => void;
  /** The post screen shows the whole text and does not open itself again. */
  full?: boolean;
};

const COLLAPSE_AFTER = 320;
const PREVIEW_LENGTH = 260;

/** A feed entry in the Threads rhythm: avatar column, then author, type, text and actions. */
export const PostRow = memo(function PostRow({ post, clock, onAction, onOpen, full }: Props) {
  const styles = useStyles();
  const [expanded, setExpanded] = useState(false);
  const collapsible = !full && post.text.length > COLLAPSE_AFTER;
  const text =
    collapsible && !expanded ? `${post.text.slice(0, PREVIEW_LENGTH).trimEnd()}…` : post.text;

  return (
    <View style={styles.row} testID={`post-${post.id}`} role="article">
      <Avatar avatar={post.author.avatar} size={36} />
      <View style={styles.content}>
        {/* Only the full view carries an id; a safe author cannot be opened. */}
        {post.author.view === 'member' ? (
          <Pressable
            role="link"
            aria-label={strings.post.openAuthor(post.author.name)}
            onPress={() =>
              post.author.view === 'member' && onOpen({ kind: 'member', id: post.author.id })
            }
            testID="post-author"
          >
            <AuthorRow author={post.author} time={formatRelative(post.createdAt, clock)} />
          </Pressable>
        ) : (
          <AuthorRow author={post.author} time={formatRelative(post.createdAt, clock)} />
        )}
        {post.type !== 'post' ? (
          <AppText variant="caption" tone="textMuted" testID="post-type">
            {strings.post.type[post.type]}
          </AppText>
        ) : null}
        {full ? (
          <AppText testID="post-text">{text}</AppText>
        ) : (
          <Pressable
            role="link"
            aria-label={strings.post.open}
            onPress={() => onOpen({ kind: 'post', id: post.id })}
            testID="post-open"
          >
            <AppText>{text}</AppText>
          </Pressable>
        )}
        {collapsible && !expanded ? (
          <Pressable role="button" onPress={() => setExpanded(true)} hitSlop={8}>
            <AppText variant="bodyStrong">{strings.post.showMore}</AppText>
          </Pressable>
        ) : null}
        {post.topics.length > 0 ? (
          <AppText tone="textMuted">
            {post.topics.map((t) => `#${topicLabels[t]}`).join('  ')}
          </AppText>
        ) : null}
        {post.plan ? (
          <Pressable
            role="link"
            aria-label={strings.plan.open}
            onPress={() => post.plan && onOpen({ kind: 'plan', id: post.plan.id })}
          >
            <PlanCard plan={post.plan} clock={clock} />
          </Pressable>
        ) : null}
        {post.quoted ? (
          <Pressable
            role="link"
            aria-label={strings.post.open}
            onPress={() => post.quoted && onOpen({ kind: 'post', id: post.quoted.id })}
            style={styles.quoted}
            testID="quoted-post"
          >
            <AuthorRow author={post.quoted.author} />
            <AppText numberOfLines={3}>{post.quoted.text}</AppText>
          </Pressable>
        ) : null}
        {post.media ? (
          <SyntheticMedia mediaKey={post.media.key} accessibilityLabel={strings.post.media} />
        ) : null}
        <View style={styles.actions}>
          <ActionButton
            icon={MessageCircle}
            count={post.commentsCount}
            label={strings.post.actions.comment(post.commentsCount)}
            onPress={() => onAction('comment', post)}
          />
          <ActionButton
            icon={Heart}
            count={post.reactions}
            label={strings.post.actions.reaction(post.reactions)}
            active={post.reactedByMe}
            testID="post-like"
            onPress={() => onAction('reaction', post)}
          />
          <ActionButton
            icon={Repeat2}
            count={post.reposts}
            label={strings.post.actions.repost(post.reposts)}
            active={post.repostedByMe}
            // A line icon has nothing to fill: an active repost gets a heavier stroke.
            activeLook="bold"
            // One's own post cannot be reposted, only quoted.
            disabled={post.mine}
            testID="post-repost"
            onPress={() => onAction('repost', post)}
          />
          <ActionButton
            icon={Quote}
            label={strings.post.actions.quote}
            testID="post-quote"
            onPress={() => onAction('quote', post)}
          />
        </View>
      </View>
    </View>
  );
});

function ActionButton({
  icon: IconComponent,
  count,
  label,
  active,
  activeLook = 'fill',
  disabled,
  onPress,
  testID,
}: {
  icon: Icon;
  count?: number;
  label: string;
  /** Toggle actions (like, repost) report their state; the icon changes, not just its colour. */
  active?: boolean;
  activeLook?: 'fill' | 'bold';
  disabled?: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const color = disabled ? colors.disabledText : colors.text;
  return (
    <Pressable
      role="button"
      aria-label={label}
      aria-pressed={active}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
    >
      <IconComponent
        size={20}
        color={color}
        fill={active && activeLook === 'fill' ? color : 'none'}
        strokeWidth={active && activeLook === 'bold' ? iconStroke.active : iconStroke.default}
      />
      {count !== undefined && count > 0 ? (
        <AppText variant="caption" tone="textMuted">
          {String(count)}
        </AppText>
      ) : null}
    </Pressable>
  );
}

function PlanCard({ plan, clock }: { plan: PlanSummary; clock: Clock }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const time = plan.timeEnd ? `${plan.timeStart}–${plan.timeEnd}` : plan.timeStart;
  const detail = (icon: Icon, text: string) => {
    const IconComponent = icon;
    return (
      <View style={styles.planLine}>
        <IconComponent size={16} color={colors.textMuted} strokeWidth={iconStroke.default} />
        <AppText variant="caption">{text}</AppText>
      </View>
    );
  };

  return (
    <View style={styles.plan} testID="plan-card">
      <AppText variant="bodyStrong">
        {`${meetingFormatLabels[plan.format]} · ${meetingGoalLabels[plan.goal]}`}
      </AppText>
      {detail(Calendar, `${formatPlanDate(plan.date, clock)} · ${time}`)}
      {detail(ClockIcon, strings.plan.minutes(plan.durationMinutes))}
      {detail(
        MapPin,
        `${cityLabels[plan.city]}${plan.isPublicPlace ? ` · ${strings.plan.publicPlace}` : ''}`,
      )}
      {detail(Wallet, paymentPolicyLabels[plan.paymentPolicy])}
      {plan.status === 'matched' ? (
        <AppText variant="caption" tone="textMuted">
          {strings.plan.matched}
        </AppText>
      ) : null}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.bg,
  },
  content: { flex: 1, gap: spacing.xs + 2 },
  quoted: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  plan: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs + 2,
    backgroundColor: colors.surface,
  },
  planLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  actions: { flexDirection: 'row', marginLeft: -spacing.sm },
  action: {
    minWidth: minTouch,
    minHeight: minTouch,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.pill,
  },
  actionPressed: { backgroundColor: colors.surfacePressed },
}));
