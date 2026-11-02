import { useState } from 'react';
import { View } from 'react-native';

import { isRepositoryError, LIMITS, SupportTopic } from '@/contracts';
import { useCreateSupportRequest, useMySupportRequests } from '@/data/hooks';
import { useClock } from '@/data/RepositoryProvider';
import { newIdempotencyKey } from '@/features/access/steps';
import { PrimaryButton, SecondaryButton } from '@/ui/components/buttons';
import { RadioGroup } from '@/ui/components/RadioGroup';
import { TextArea } from '@/ui/components/TextArea';
import { AppText } from '@/ui/components/Text';
import { formatRelative } from '@/ui/format';
import { strings } from '@/ui/strings';
import { radius, spacing } from '@/ui/theme/tokens';
import { createStyles } from '@/ui/theme/useStyles';

const t = strings.support;
const topicOptions = SupportTopic.options.map((value) => ({ value, label: t.topics[value] }));

/**
 * Обращение в поддержку: a topic and a text, then «Мои обращения». What was typed stays
 * until the server confirms, and a retry reuses its key, so nothing is sent twice.
 */
export function SupportForm({
  initialTopic,
  testID = 'support',
}: {
  initialTopic?: SupportTopic;
  testID?: string;
}) {
  const styles = useStyles();
  const create = useCreateSupportRequest();
  const [topic, setTopic] = useState<SupportTopic | undefined>(initialTopic);
  const [text, setText] = useState('');
  const [idempotencyKey, setKey] = useState(newIdempotencyKey);
  const [sent, setSent] = useState(false);
  const canSend = !!topic && text.trim().length > 0 && !create.isPending;
  const failed = create.isError && !(isRepositoryError(create.error) && create.error.fieldErrors);

  const send = () => {
    if (!topic || !canSend) return;
    create.mutate(
      { topic, text: text.trim(), idempotencyKey },
      {
        onSuccess: () => {
          setText('');
          setKey(newIdempotencyKey());
          setSent(true);
        },
      },
    );
  };

  return (
    <View style={styles.root} testID={testID}>
      <AppText tone="textMuted">{t.hint}</AppText>
      <AppText variant="bodyStrong">{t.topicLabel}</AppText>
      <RadioGroup
        label={t.topicLabel}
        options={topicOptions}
        value={topic}
        onChange={(value) => {
          setTopic(value);
          setSent(false);
        }}
        testID={`${testID}-topic`}
      />
      <TextArea
        label={t.textLabel}
        value={text}
        onChangeText={(value) => {
          setText(value);
          setSent(false);
          if (create.isError) create.reset();
        }}
        placeholder={t.placeholder}
        maxLength={LIMITS.supportText}
        testID={`${testID}-text`}
      />
      {failed ? (
        <AppText tone="danger" role="alert" testID={`${testID}-error`}>
          {t.failed}
        </AppText>
      ) : null}
      {sent ? (
        <AppText role="status" testID={`${testID}-sent`}>
          {t.sent}
        </AppText>
      ) : null}
      <PrimaryButton
        label={t.send}
        disabled={!canSend}
        loading={create.isPending}
        onPress={send}
        testID={`${testID}-send`}
      />
      <MyRequests testID={`${testID}-mine`} />
    </View>
  );
}

function MyRequests({ testID }: { testID: string }) {
  const styles = useStyles();
  const clock = useClock();
  const list = useMySupportRequests(true);
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <View style={styles.mine} testID={testID}>
      <AppText variant="title" role="heading">
        {t.mineTitle}
      </AppText>
      {list.isSuccess && items.length === 0 ? (
        <AppText tone="textMuted" testID={`${testID}-empty`}>
          {t.mineEmpty}
        </AppText>
      ) : null}
      {items.map((request) => (
        <View key={request.id} style={styles.request} testID={`${testID}-${request.id}`}>
          <AppText variant="bodyStrong">
            {`${t.topics[request.topic]} · ${t.status[request.status]}`}
          </AppText>
          <AppText numberOfLines={2} tone="textMuted">
            {request.text}
          </AppText>
          <AppText variant="caption" tone="textMuted">
            {formatRelative(request.createdAt, clock)}
          </AppText>
        </View>
      ))}
      {list.hasNextPage ? (
        <SecondaryButton
          label={t.more}
          loading={list.isFetchingNextPage}
          onPress={() => list.fetchNextPage()}
          testID={`${testID}-more`}
        />
      ) : null}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  root: { gap: spacing.sm },
  mine: { gap: spacing.sm, marginTop: spacing.md },
  request: {
    gap: 2,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
}));
