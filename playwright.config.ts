import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.PORT ?? 4173);
const phone = { viewport: { width: 390, height: 844 }, hasTouch: true };

export default defineConfig({
  testDir: 'e2e',
  // Every test has its own browser context (and so its own mock state), so tests of one
  // file may run in parallel; CI shards then split by test, not by whole files.
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  // Visual baselines: one file per screen and theme. They are rendered in CI inside the
  // Playwright image, so local runs on another OS may differ (README → «Визуальные эталоны»).
  snapshotPathTemplate: '{testDir}/__screenshots__/{arg}-{projectName}{ext}',
  expect: {
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      threshold: 0.2,
      maxDiffPixelRatio: 0.01,
      stylePath: './e2e/visual.css',
    },
  },
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
  },
  // The device preset brings its own desktop viewport, so the phone size is set after it.
  projects: [
    { name: 'light', use: { ...devices['Desktop Chrome'], ...phone, colorScheme: 'light' } },
    { name: 'dark', use: { ...devices['Desktop Chrome'], ...phone, colorScheme: 'dark' } },
  ],
  webServer: {
    command: 'node scripts/serve-dist.mjs',
    port,
    reuseExistingServer: !process.env.CI,
  },
});
