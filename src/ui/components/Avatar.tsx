import Svg, { Circle, Path, Rect } from 'react-native-svg';

import type { AvatarRef } from '@/contracts';
import { avatarSwatches } from '@/ui/theme/palette';
import { useTheme } from '@/ui/theme/ThemeProvider';

/** Stable 32-bit hash so the same key always draws the same avatar. */
export function hashKey(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i += 1) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

type Props = { avatar: AvatarRef; size?: number };

export function Avatar({ avatar, size = 36 }: Props) {
  return avatar.kind === 'neutral' ? (
    <NeutralAvatar size={size} />
  ) : (
    <SyntheticAvatar avatarKey={avatar.key} size={size} />
  );
}

/**
 * The single silhouette every guest-facing author shares. It never depends on the
 * person, so it cannot identify anyone.
 */
export function NeutralAvatar({ size }: { size: number }) {
  const { colors } = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" accessibilityElementsHidden>
      <Circle cx={20} cy={20} r={20} fill={colors.surfacePressed} />
      <Circle cx={20} cy={16} r={6.5} fill={colors.textMuted} opacity={0.55} />
      <Path d="M8 34c2.4-6.2 7-9 12-9s9.6 2.8 12 9" fill={colors.textMuted} opacity={0.55} />
    </Svg>
  );
}

/** Abstract, deterministic avatar: colour and a simple shape from the key. No face, no initials. */
export function SyntheticAvatar({ avatarKey, size }: { avatarKey: string; size: number }) {
  const { scheme } = useTheme();
  const hash = hashKey(avatarKey);
  const swatches = avatarSwatches[scheme];
  const swatch = swatches[hash % swatches.length] ?? swatches[0]!;
  const shape = (hash >> 4) % 3;
  const rotate = (hash >> 8) % 360;

  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" accessibilityElementsHidden>
      <Circle cx={20} cy={20} r={20} fill={swatch.bg} />
      {shape === 0 ? <Circle cx={24} cy={24} r={11} fill={swatch.fg} opacity={0.85} /> : null}
      {shape === 1 ? (
        <Rect
          x={11}
          y={11}
          width={18}
          height={18}
          rx={5}
          fill={swatch.fg}
          opacity={0.85}
          transform={`rotate(${rotate} 20 20)`}
        />
      ) : null}
      {shape === 2 ? (
        <Path
          d="M20 8 L32 30 L8 30 Z"
          fill={swatch.fg}
          opacity={0.85}
          transform={`rotate(${rotate} 20 20)`}
        />
      ) : null}
    </Svg>
  );
}
