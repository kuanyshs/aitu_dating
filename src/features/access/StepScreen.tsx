import { useRouter, type Href } from 'expo-router';
import type { ReactNode } from 'react';

import type { AccessFlowStep } from '@/contracts';
import { FlowScreen } from '@/ui/components/FlowScreen';
import { strings } from '@/ui/strings';

import { stepNumber, stepOrder, stepRoute } from './steps';

type Props = {
  step: AccessFlowStep;
  title: string;
  text?: string;
  children: ReactNode;
  footer?: ReactNode;
  testID: string;
};

/** Shell of every access-flow step: back, progress, close, content and a sticky footer. */
export function StepScreen({ step, title, text, children, footer, testID }: Props) {
  const router = useRouter();
  const index = stepNumber(step);
  const previous = index > 1 ? stepOrder[index - 2] : undefined;

  return (
    <FlowScreen
      title={title}
      text={text}
      progress={strings.access.step(index, stepOrder.length)}
      progressTestID="access-progress"
      back={
        previous && previous !== 'payment'
          ? {
              label: strings.access.back,
              onPress: () => router.replace(stepRoute(previous) as Href),
              testID: 'access-back',
            }
          : undefined
      }
      close={{
        label: strings.access.close,
        onPress: () => router.dismissTo('/'),
        testID: 'access-close',
      }}
      footer={footer}
      testID={testID}
    >
      {children}
    </FlowScreen>
  );
}
