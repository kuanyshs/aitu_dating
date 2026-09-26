export type ColorScheme = 'light' | 'dark';

/** The user's appearance choice; `system` follows the OS setting. */
export type ThemePreference = 'system' | ColorScheme;

/**
 * Resolves the scheme to render. React Native may report `null` or `unspecified`
 * when the platform has no preference; those fall back to light.
 */
export function resolveScheme(
  preference: ThemePreference,
  system: string | null | undefined,
): ColorScheme {
  if (preference !== 'system') return preference;
  return system === 'dark' ? 'dark' : 'light';
}
