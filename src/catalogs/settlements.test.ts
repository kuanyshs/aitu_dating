import { describe, expect, it } from 'vitest';

import {
  districtsOf,
  majorCityCodes,
  normalizeName,
  regions,
  searchSettlements,
  settlementByCode,
  settlements,
  settlementsOf,
} from './settlements';

describe('the settlements directory (KATO)', () => {
  it('holds every city, town and village with its district and region', () => {
    expect(settlements.length).toBeGreaterThan(9000);
    expect(regions).toHaveLength(20);
    const karaaul = settlementByCode('103230100');
    expect(karaaul).toMatchObject({
      name: 'Карааул',
      kind: 'village',
      district: { name: 'Абайский район' },
      region: { name: 'область Абай' },
    });
  });

  it('has the largest cities, the republican ones as regions of their own', () => {
    expect(settlementByCode(majorCityCodes.almaty)).toMatchObject({ name: 'Алматы', kind: 'city' });
    expect(settlementByCode(majorCityCodes.astana)?.district).toBeUndefined();
    expect(settlementByCode(majorCityCodes.karaganda)).toMatchObject({
      name: 'Караганда',
      region: { name: 'Карагандинская область' },
    });
  });

  it('finds by name ignoring case, «ё» and Kazakh letters; exact, then prefix, cities first', () => {
    expect(normalizeName('Қонаев')).toBe('конаев');
    expect(searchSettlements('конаев')[0]?.name).toBe('Қонаев');
    const karaganda = searchSettlements('караганда');
    expect(karaganda[0]).toMatchObject({ name: 'Караганда', kind: 'city' });
    expect(karaganda.every((s, i) => i === 0 || s.name.toLowerCase().includes('караганда'))).toBe(
      true,
    );
    expect(searchSettlements('а')).toEqual([]);
  });

  it('is browsed region → district → settlement', () => {
    const abai = regions.find((r) => r.name === 'область Абай')!;
    const district = districtsOf(abai.code).find((d) => d.name === 'Абайский район')!;
    expect(settlementsOf({ district: district.code }).map((s) => s.name)).toContain('Карааул');
    expect(settlementsOf({ region: '71' }).map((s) => s.name)).toEqual(['Астана']);
  });
});
