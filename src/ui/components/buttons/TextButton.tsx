import { Text } from 'react-native';

import { radius, spacing, typography } from '@/ui/theme/tokens';

import { BaseButton, type BaseButtonProps } from './BaseButton';

type Props = BaseButtonProps & { label: string };

export function TextButton({ label, ...rest }: Props) {
  return (
    <BaseButton
      {...rest}
      variant="text"
      shape={{ borderRadius: radius.md, paddingHorizontal: spacing.md, alignSelf: 'flex-start' }}
    >
      {(color) => <Text style={[typography.bodyStrong, { color }]}>{label}</Text>}
    </BaseButton>
  );
}
