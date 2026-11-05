import { describe, expect, it } from 'vitest';

import { formatDuration, voiceType } from './voice';

describe('voice helpers', () => {
  it('keep the base format the contract knows', () => {
    expect(voiceType('audio/webm;codecs=opus')).toBe('audio/webm');
    expect(voiceType('audio/ogg; codecs=opus')).toBe('audio/ogg');
    expect(voiceType('audio/mp4')).toBe('audio/mp4');
    expect(voiceType('audio/x-unknown')).toBe('audio/webm');
  });

  it('show minutes and seconds', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(7_400)).toBe('0:07');
    expect(formatDuration(60_000)).toBe('1:00');
  });
});
