import type { Icon } from '@/ui/icons';
import { iconStroke, minTouch, radius } from '@/ui/theme/tokens';

import { BaseButton, type BaseButtonProps } from './BaseButton';

type Props = Omit<BaseButtonProps, 'accessibilityLabel'> & {
  icon: Icon;
  /** Required: an icon has no visible text for screen readers. */
  accessibilityLabel: string;
  size?: number;
};

export function IconAction({ icon: IconComponent, size = 22, ...rest }: Props) {
  return (
    <BaseButton
      {...rest}
      variant="text"
      shape={{ width: minTouch, height: minTouch, borderRadius: radius.pill }}
    >
      {(color) => <IconComponent size={size} color={color} strokeWidth={iconStroke.default} />}
    </BaseButton>
  );
}
