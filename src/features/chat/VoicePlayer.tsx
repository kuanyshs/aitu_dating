import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { formatDuration } from '@/media';
import { AppText } from '@/ui/components/Text';
import { Pause, Play } from '@/ui/icons';
import { strings } from '@/ui/strings';
import { minTouch, radius, spacing } from '@/ui/theme/tokens';
import { createStyles } from '@/ui/theme/useStyles';

const t = strings.chat.voice;

/** «Воспроизвести» / «Пауза» and the length; while playing, how far it has got. */
export function VoicePlayer({
  url,
  durationMs,
  color,
  testID,
}: {
  url: string;
  durationMs: number;
  color: string;
  testID: string;
}) {
  const styles = useStyles();
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);

  useEffect(() => {
    if (typeof Audio === 'undefined') return;
    const element = new Audio(url);
    audio.current = element;
    const onTime = () => setPosition(element.currentTime * 1000);
    const onEnd = () => {
      setPlaying(false);
      setPosition(0);
    };
    element.addEventListener('timeupdate', onTime);
    element.addEventListener('ended', onEnd);
    return () => {
      element.pause();
      element.removeEventListener('timeupdate', onTime);
      element.removeEventListener('ended', onEnd);
      audio.current = null;
    };
  }, [url]);

  const toggle = () => {
    const element = audio.current;
    if (!element) return;
    if (playing) {
      element.pause();
      setPlaying(false);
    } else {
      setPlaying(true);
      element.play().catch(() => setPlaying(false));
    }
  };

  const Icon = playing ? Pause : Play;
  return (
    <View style={styles.row} aria-label={t.label} testID={testID}>
      <Pressable
        role="button"
        aria-label={playing ? t.pause : t.play}
        onPress={toggle}
        style={styles.button}
        testID={`${testID}-${playing ? 'pause' : 'play'}`}
      >
        <Icon size={20} color={color} />
      </Pressable>
      <AppText variant="caption" style={{ color }} testID={`${testID}-duration`}>
        {playing ? formatDuration(position) : formatDuration(durationMs)}
      </AppText>
    </View>
  );
}

const useStyles = createStyles(() => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minWidth: 140 },
  button: {
    width: minTouch - 8,
    height: minTouch - 8,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
