import { View } from 'react-native';

import { spacing } from '@/ui/theme/tokens';
import { createStyles } from '@/ui/theme/useStyles';

import { SecondaryButton } from './buttons';
import { AppText } from './Text';

type Action = { label: string; onPress: () => void; testID?: string };

type Props = {
  title: string;
  text: string;
  action?: Action;
  testID?: string;
};

/** Explains why there is nothing to show and offers the next step. */
export function EmptyState({ title, text, action, testID }: Props) {
  return <Message title={title} text={text} action={action} testID={testID} role="status" />;
}

/** A failed load with an explicit retry; never a silent blank screen. */
export function ErrorState({ title, text, action, testID }: Props) {
  return <Message title={title} text={text} action={action} testID={testID} role="alert" />;
}

function Message({ title, text, action, testID, role }: Props & { role: 'status' | 'alert' }) {
  const styles = useStyles();
  return (
    <View style={styles.root} testID={testID} role={role}>
      <AppText variant="title" style={styles.center}>
        {title}
      </AppText>
      <AppText tone="textMuted" style={styles.center}>
        {text}
      </AppText>
      {action ? (
        <SecondaryButton label={action.label} onPress={action.onPress} testID={action.testID} />
      ) : null}
    </View>
  );
}

const useStyles = createStyles(() => ({
  root: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    gap: spacing.md,
    alignItems: 'center',
  },
  center: { textAlign: 'center' },
}));
