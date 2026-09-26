import { Text } from 'react-native';

import { radius, spacing, typography } from '@/ui/theme/tokens';

import { BaseButton, type BaseButtonProps } from './BaseButton';

type Props = BaseButtonProps & { label: string };

export function SecondaryButton({ label, ...rest }: Props) {
  return (
    <BaseButton
      {...rest}
      variant="secondary"
      shape={{ minHeight: 48, borderRadius: radius.pill, paddingHorizontal: spacing.xl - 4 }}
    >
      {(color) => <Text style={[typography.bodyStrong, { color }]}>{label}</Text>}
    </BaseButton>
  );
}
