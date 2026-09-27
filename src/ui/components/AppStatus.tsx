import { useEffect } from 'react';
import { View } from 'react-native';

import { useDemoFlags } from '@/data/hooks';
import { useDemoControls } from '@/data/RepositoryProvider';
import { WifiOff } from '@/ui/icons';
import { useStatusBottom } from '@/ui/navigation/statusInset';
import { strings } from '@/ui/strings';
import { useToast } from '@/ui/toast';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, spacing } from '@/ui/theme/tokens';
import { createStyles } from '@/ui/theme/useStyles';

import { AppText } from './Text';

const TOAST_MS = 2600;

/**
 * App-wide status above the floating tab bar (or a full-screen surface's own bottom
 * bar): the offline banner, and the toast stacked over it, so neither covers header
 * actions or the surface's button.
 */
export function AppStatus() {
  return (
    <>
      <OfflineBanner />
      <ToastHost />
      <ResetNotice />
    </>
  );
}

function OfflineBanner() {
  const styles = useStyles();
  const { colors } = useTheme();
  const bottom = useStatusBottom();
  const { offline } = useDemoFlags();
  if (!offline) return null;
  return (
    <View
      role="alert"
      testID="offline-banner"
      pointerEvents="none"
      style={[styles.banner, { bottom }]}
    >
      <WifiOff size={16} color={colors.onPrimary} strokeWidth={2} />
      <AppText variant="caption" tone="onPrimary">
        {strings.offline.banner}
      </AppText>
    </View>
  );
}

function ToastHost() {
  const styles = useStyles();
  const bottom = useStatusBottom() + 52;
  const { message, id, hide } = useToast();

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(hide, TOAST_MS);
    return () => clearTimeout(timer);
  }, [message, id, hide]);

  if (!message) return null;
  return (
    <View
      role="status"
      aria-live="polite"
      testID="toast"
      pointerEvents="none"
      style={[styles.toast, { bottom }]}
    >
      <AppText variant="bodyStrong" tone="onPrimary" style={styles.center}>
        {message}
      </AppText>
    </View>
  );
}

/** Tells the user once when stored data could not be migrated and was reset. */
function ResetNotice() {
  const demo = useDemoControls();
  const show = useToast((s) => s.show);
  useEffect(() => {
    demo?.takeResetNotice().then((notice) => {
      if (notice) show(strings.storage.resetNotice);
    });
  }, [demo, show]);
  return null;
}

const useStyles = createStyles((colors) => ({
  banner: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    zIndex: 10,
  },
  toast: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    zIndex: 10,
  },
  center: { textAlign: 'center' },
}));
