// Runs the visual baselines inside the same Playwright image CI uses, so pixels match.
// Usage: pnpm e2e:visual:docker [--update]   (needs Docker and a built dist/)
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const { devDependencies } = JSON.parse(readFileSync('package.json', 'utf8'));
const version = devDependencies['@playwright/test'];
const image = `mcr.microsoft.com/playwright:v${version}-noble`;
const update = process.argv.includes('--update');

const result = spawnSync(
  'docker',
  [
    'run',
    '--rm',
    '--ipc=host',
    '-e',
    'CI=1',
    '-v',
    `${process.cwd()}:/work`,
    '-w',
    '/work',
    image,
    'npx',
    'playwright',
    'test',
    '--grep',
    '@visual',
    ...(update ? ['--update-snapshots'] : []),
  ],
  { stdio: 'inherit' },
);
process.exit(result.status ?? 1);
