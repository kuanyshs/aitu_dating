import { View } from 'react-native';

import { cityLabels, genderLabels } from '@/catalogs';
import type { AuthorView } from '@/contracts';
import { BadgeCheck } from '@/ui/icons';
import { strings } from '@/ui/strings';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { spacing } from '@/ui/theme/tokens';

import { AppText } from './Text';

type Props = { author: AuthorView; time?: string };

/**
 * Accepts only the shaped author view, never a full user record. A guest sees
 * «Женщина, 27 · Алматы»; a member sees the name and verified mark.
 */
export function AuthorRow({ author, time }: Props) {
  const { colors } = useTheme();
  const city = cityLabels[author.city];

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' }}>
      {author.view === 'member' ? (
        <>
          <AppText variant="bodyStrong" testID="author-name">
            {author.name}
          </AppText>
          {author.verified ? (
            <BadgeCheck
              size={15}
              color={colors.text}
              strokeWidth={2}
              aria-label={strings.post.verified}
            />
          ) : null}
          <AppText tone="textMuted">{`· ${city}`}</AppText>
        </>
      ) : (
        <AppText variant="bodyStrong" testID="author-safe">
          {`${strings.post.authorSafe(genderLabels[author.gender], author.age)} · ${city}`}
        </AppText>
      )}
      {time ? <AppText tone="textMuted">{`· ${time}`}</AppText> : null}
    </View>
  );
}
