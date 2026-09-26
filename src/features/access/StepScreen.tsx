import { useRouter, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { AccessFlowStep } from '@/contracts';
import { IconAction } from '@/ui/components/buttons';
import { AppText } from '@/ui/components/Text';
import { ChevronLeft, X } from '@/ui/icons';
import { strings } from '@/ui/strings';
import { spacing } from '@/ui/theme/tokens';
import { createStyles } from '@/ui/theme/useStyles';

import { stepNumber, stepOrder, stepRoute } from './steps';

type Props = {
  step: AccessFlowStep;
  title: string;
  text?: string;
  children: ReactNode;
  /** Sticky action area; stays above the keyboard and the bottom inset. */
  footer?: ReactNode;
  testID: string;
};

/** Shell of every access-flow step: back, progress, close, content and a sticky footer. */
export function StepScreen({ step, title, text, children, footer, testID }: Props) {
  const styles = useStyles();
  const router = useRouter();
  const index = stepNumber(step);
  const previous = index > 1 ? stepOrder[index - 2] : undefined;

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.root} testID={testID}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          {previous && previous !== 'payment' ? (
            <IconAction
              icon={ChevronLeft}
              accessibilityLabel={strings.access.back}
              onPress={() => router.replace(stepRoute(previous) as Href)}
              testID="access-back"
            />
          ) : (
            <View style={styles.headerSpacer} />
          )}
          <AppText variant="caption" tone="textMuted" testID="access-progress">
            {strings.access.step(index, stepOrder.length)}
          </AppText>
          <IconAction
            icon={X}
            accessibilityLabel={strings.access.close}
            onPress={() => router.dismissTo('/')}
            testID="access-close"
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
