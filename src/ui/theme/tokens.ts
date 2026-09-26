export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 8, md: 12, lg: 20, pill: 999 } as const;

export const typography = {
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  body: { fontSize: 15, lineHeight: 21, fontWeight: '400' },
  bodyStrong: { fontSize: 15, lineHeight: 21, fontWeight: '600' },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  display: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
} as const;

export type TypographyVariant = keyof typeof typography;

/** Minimum touch target, in points (Apple HIG / WCAG 2.5.5). */
export const minTouch = 44;

export const iconStroke = { default: 1.75, active: 2.5 } as const;

export const tabBarLayout = {
  height: 64,
  maxWidth: 420,
  sideMargin: 16,
  minBottomOffset: 12,
  contentGap: 16,
  iconSize: 26,
  pillWidth: 52,
  pillHeight: 40,
} as const;
