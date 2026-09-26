import { StepScreen } from '@/features/access/StepScreen';
import { useStepGuard } from '@/features/access/useStepGuard';
import { AppText } from '@/ui/components/Text';
import { strings } from '@/ui/strings';

// Temporary: ticket 05 builds the profile step and the questionnaire here.
export default function ProfileStep() {
  useStepGuard('profile');
  return (
    <StepScreen step="profile" title={strings.access.profileStep.title} testID="access-profile">
      <AppText tone="textMuted">{strings.access.profileStep.text}</AppText>
    </StepScreen>
  );
}
