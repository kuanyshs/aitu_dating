import { describe, expect, it } from 'vitest';

import { contrastRatio } from './contrast';
import { contrastPairs } from './contrastPairs';
import { palettes } from './palette';

describe('contrastRatio', () => {
  it('matches the WCAG reference values', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
    expect(contrastRatio('#777777', '#FFFFFF')).toBeCloseTo(4.48, 2);
  });
});

describe.each(Object.entries(palettes))('%s palette', (_name, colors) => {
  it.each(contrastPairs.map((pair) => [`${pair.foreground} on ${pair.background}`, pair] as const))(
    '%s meets WCAG AA',
    (_label, pair) => {
      const ratio = contrastRatio(colors[pair.foreground], colors[pair.background]);
      expect(ratio).toBeGreaterThanOrEqual(pair.min);
    },
  );
});
