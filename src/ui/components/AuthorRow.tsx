import { View } from 'react-native';

import { settlementName, genderLabels } from '@/catalogs';
import type { AuthorView } from '@/contracts';
import { BadgeCheck } from '@/ui/icons';
import { fullName } from '@/ui/format';
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
  const city = settlementName(author.city);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' }}>
      {author.view === 'member' ? (
        <>
          <AppText variant="bodyStrong" testID="author-name">
            {fullName(author)}
          </AppText>
          {author.verified ? (
            <BadgeCheck
              size={15}
              color={colors.text}
              strokeWidth={2}
              aria-label={strings.post.verified}
            />
          ) : null}
          {city ? <AppText tone="textMuted">{`· ${city}`}</AppText> : null}
        </>
      ) : (
        <AppText variant="bodyStrong" testID="author-safe">
          {`${strings.post.authorSafe(genderLabels[author.gender], author.age)}${city ? ` · ${city}` : ''}`}
        </AppText>
      )}
      {time ? <AppText tone="textMuted">{`· ${time}`}</AppText> : null}
    </View>
  );
}
