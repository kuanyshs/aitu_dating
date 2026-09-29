import { describe, expect, it } from 'vitest';

import { strings } from './strings';

describe('age in the follow lists', () => {
  it.each([
    [18, '18 лет'],
    [21, '21 год'],
    [22, '22 года'],
    [24, '24 года'],
    [25, '25 лет'],
    [31, '31 год'],
    [111, '111 лет'],
    [112, '112 лет'],
    [114, '114 лет'],
    [101, '101 год'],
  ])('%i → %s', (age, text) => {
    expect(strings.follows.age(age)).toBe(text);
  });
});
