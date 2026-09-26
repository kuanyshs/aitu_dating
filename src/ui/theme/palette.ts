// The only module allowed to hold raw color values. Everything else reads semantic tokens.

export type ColorTokens = {
  bg: string;
  surface: string;
  surfacePressed: string;
  /** Sheets and dialogs above the page. */
  surfaceRaised: string;
  /** Dims the page behind a sheet. */
  scrim: string;
  text: string;
  textMuted: string;
  line: string;
  primary: string;
  primaryPressed: string;
  onPrimary: string;
  danger: string;
  disabledBg: string;
  disabledText: string;
  tabBar: string;
  tabBarBorder: string;
  tabActive: string;
  tabIcon: string;
  tabIconActive: string;
  tabBarShadow: string;
};

export const lightColors: ColorTokens = {
  bg: '#FFFFFF',
  surface: '#F5F5F5',
  surfacePressed: '#EBEBEB',
  surfaceRaised: '#FFFFFF',
  scrim: 'rgba(0, 0, 0, 0.4)',
  text: '#0A0A0A',
  textMuted: '#666666',
  line: '#E5E5E5',
  primary: '#0A0A0A',
  primaryPressed: '#3A3A3A',
  onPrimary: '#FFFFFF',
  danger: '#C62828',
  disabledBg: '#F0F0F0',
  disabledText: '#A3A3A3',
  tabBar: '#FFFFFF',
  tabBarBorder: '#E5E5E5',
  tabActive: '#EDEDED',
  tabIcon: '#666666',
  tabIconActive: '#0A0A0A',
  tabBarShadow: '0px 8px 24px rgba(0, 0, 0, 0.08)',
};

export const darkColors: ColorTokens = {
  bg: '#101010',
  surface: '#181818',
  surfacePressed: '#202020',
  surfaceRaised: '#181818',
  scrim: 'rgba(0, 0, 0, 0.6)',
  text: '#F3F3F3',
  textMuted: '#8A8A8A',
  line: '#2A2A2A',
  primary: '#FFFFFF',
  primaryPressed: '#D6D6D6',
  onPrimary: '#0A0A0A',
  danger: '#FF6B6B',
  disabledBg: '#1F1F1F',
  disabledText: '#5C5C5C',
  tabBar: '#1C1C1C',
  tabBarBorder: '#2A2A2A',
  tabActive: '#2E2E2E',
  tabIcon: '#8A8A8A',
  tabIconActive: '#F3F3F3',
  tabBarShadow: '0px 8px 24px rgba(0, 0, 0, 0.5)',
};

export const palettes = { light: lightColors, dark: darkColors } as const;

/**
 * Background/foreground pairs for synthetic avatars and media. Chosen per theme so
 * shapes stay soft on white and do not glow on the dark background.
 */
export type AvatarSwatch = { bg: string; fg: string };

export const avatarSwatches: Record<'light' | 'dark', AvatarSwatch[]> = {
  light: [
    { bg: '#E9E4F5', fg: '#7A68B8' },
    { bg: '#E2EEF0', fg: '#4F8C96' },
    { bg: '#F4E6DC', fg: '#B57A52' },
    { bg: '#E5EEDF', fg: '#6E9460' },
    { bg: '#F3E1E6', fg: '#B0607A' },
    { bg: '#E3E7F3', fg: '#5B6FA8' },
  ],
  dark: [
    { bg: '#2B2638', fg: '#A796E0' },
    { bg: '#1F3134', fg: '#7CB7C1' },
    { bg: '#382A21', fg: '#D89C73' },
    { bg: '#25301F', fg: '#98BD89' },
    { bg: '#382329', fg: '#D98AA3' },
    { bg: '#232838', fg: '#8B9FD6' },
  ],
};
