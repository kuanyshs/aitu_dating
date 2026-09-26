import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChevronLeft, X } from '@/ui/icons';
import { spacing } from '@/ui/theme/tokens';
import { createStyles } from '@/ui/theme/useStyles';

import { IconAction } from './buttons';
import { AppText } from './Text';

type Props = {
  title: string;
  text?: string;
  /** «Шаг N из M» or similar, centred in the header. */
  progress?: string;
  progressTestID?: string;
  back?: { label: string; onPress: () => void; testID: string };
  close: { label: string; onPress: () => void; testID: string };
  children: ReactNode;
  /** Sticky action area; stays above the keyboard and the bottom inset. */
  footer?: ReactNode;
  testID: string;
};

/** Shell of a multi-step modal flow: back, progress, close, content and a sticky footer. */
export function FlowScreen({
  title,
  text,
  progress,
  progressTestID,
  back,
  close,
  children,
  footer,
  testID,
}: Props) {
  const styles = useStyles();
  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.root} testID={testID}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          {back ? (
            <IconAction
              icon={ChevronLeft}
              accessibilityLabel={back.label}
              onPress={back.onPress}
              testID={back.testID}
            />
          ) : (
            <View style={styles.headerSpacer} />
          )}
          {progress ? (
            <AppText variant="caption" tone="textMuted" testID={progressTestID}>
              {progress}
            </AppText>
          ) : null}
          <IconAction
            icon={X}
            accessibilityLabel={close.label}
            onPress={close.onPress}
            testID={close.testID}
          />
        </View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <AppText variant="display" role="heading">
            {title}
          </AppText>
          {text ? <AppText tone="textMuted">{text}</AppText> : null}
          {children}
        </ScrollView>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const useStyles = createStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
  },
  headerSpacer: { width: 44 },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.bg,
  },
}));
