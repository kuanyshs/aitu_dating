/**
 * The one place that decides whether demo tooling exists in this build. Expo inlines
 * EXPO_PUBLIC_* at build time, so with the flag off the demo panel's `require` is dead
 * code and is dropped from the bundle.
 */
export const demoToolsEnabled = process.env.EXPO_PUBLIC_DEMO_TOOLS === '1';
