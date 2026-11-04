import { AppText } from '@/ui/components/Text';
import { strings } from '@/ui/strings';

/** «Сгенерировано с ИИ» under a picture made by a generative model; nothing otherwise. */
export function AiLabel({ ai, testID, color }: { ai?: boolean; testID: string; color?: string }) {
  if (!ai) return null;
  return (
    <AppText
      variant="caption"
      tone={color ? undefined : 'textMuted'}
      style={color ? { color } : undefined}
      testID={testID}
    >
      {strings.photo.ai}
    </AppText>
  );
}
