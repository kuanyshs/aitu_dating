// The only module allowed to hold raw color values. Everything else reads semantic tokens.

export type ColorTokens = {
  bg: string;
  surface: string;
  surfacePressed: string;
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
