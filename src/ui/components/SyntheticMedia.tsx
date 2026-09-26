import { View } from 'react-native';
import Svg, { Circle, Rect } from 'react-native-svg';

import { avatarSwatches } from '@/ui/theme/palette';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius } from '@/ui/theme/tokens';

import { hashKey } from './Avatar';

type Props = { mediaKey: string; accessibilityLabel: string };

/** Placeholder picture for mock media: abstract, deterministic, theme-aware. */
export function SyntheticMedia({ mediaKey, accessibilityLabel }: Props) {
  const { scheme } = useTheme();
  const hash = hashKey(mediaKey);
  const swatches = avatarSwatches[scheme];
  const a = swatches[hash % swatches.length] ?? swatches[0]!;
  const b = swatches[(hash >> 3) % swatches.length] ?? swatches[1]!;

  return (
    <View
      role="img"
      aria-label={accessibilityLabel}
      style={{ borderRadius: radius.lg, overflow: 'hidden', aspectRatio: 4 / 3, width: '100%' }}
    >
      <Svg width="100%" height="100%" viewBox="0 0 120 90" preserveAspectRatio="xMidYMid slice">
        <Rect x={0} y={0} width={120} height={90} fill={a.bg} />
        <Circle cx={36} cy={52} r={26} fill={a.fg} opacity={0.7} />
        <Rect x={62} y={20} width={40} height={52} rx={8} fill={b.fg} opacity={0.6} />
        <Circle cx={92} cy={24} r={10} fill={b.bg} opacity={0.9} />
      </Svg>
    </View>
  );
}
