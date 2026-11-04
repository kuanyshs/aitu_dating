import data from './settlements.json';

/**
 * Населённые пункты of Kazakhstan from the official KATO (see scripts/build-settlements.mjs):
 * one directory for the Анкета, profiles, filters, Встречи and search. A settlement is
 * identified by its 9-digit KATO code.
 */

export type SettlementKind = 'city' | 'town' | 'village';
const kinds: SettlementKind[] = ['city', 'town', 'village'];

export interface Region {
  code: string;
  name: string;
}

export interface District {
  code: string;
  name: string;
  region: Region;
}

export interface Settlement {
  code: string;
  name: string;
  kind: SettlementKind;
  /** Absent for a city of republican significance, which is a region of its own. */
  district?: District;
  region: Region;
}

type RawSettlement = [code: string, name: string, kind: number, district: number, region: number];
const raw = data as unknown as {
  edition: string;
  regions: [string, string][];
  districts: [string, string, number][];
  settlements: RawSettlement[];
};

export const settlementsEdition = raw.edition;

export const regions: Region[] = raw.regions.map(([code, name]) => ({ code, name }));
export const districts: District[] = raw.districts.map(([code, name, region]) => ({
  code,
  name,
  region: regions[region]!,
}));
export const settlements: Settlement[] = raw.settlements.map(
  ([code, name, kind, district, region]) => ({
    code,
    name,
    kind: kinds[kind]!,
    ...(district >= 0 ? { district: districts[district]! } : {}),
    region: regions[region]!,
  }),
);

const byCode = new Map(settlements.map((s) => [s.code, s]));

export const settlementCodes = settlements.map((s) => s.code);

export function settlementByCode(code: string): Settlement | undefined {
  return byCode.get(code);
}

export const isSettlementCode = (code: string) => byCode.has(code);

/** The KATO codes of the four largest cities, as the seed and older saved data used them. */
export const majorCityCodes = {
  almaty: '750000000',
  astana: '710000000',
  karaganda: '351010000',
  shymkent: '790000000',
} as const;

/** Searching ignores case, «ё» and the letters Kazakh names add to the Russian alphabet. */
export function normalizeName(text: string): string {
  return text
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[әӘ]/g, 'а')
    .replace(/[ғҒ]/g, 'г')
    .replace(/[қҚ]/g, 'к')
    .replace(/[ңҢ]/g, 'н')
    .replace(/[өӨ]/g, 'о')
    .replace(/[ұүҰҮ]/g, 'у')
    .replace(/[һҺ]/g, 'х')
    .replace(/[іІ]/g, 'и')
    .replace(/\s+/g, ' ')
    .trim();
}

const normalized = settlements.map((s) => normalizeName(s.name));

/**
 * Settlements matching a query: exact names first, then those starting with it, then those
 * containing it; within a rank cities before towns before villages, then by name.
 */
export function searchSettlements(query: string, limit = 30): Settlement[] {
  const q = normalizeName(query);
  if (q.length < 2) return [];
  const found: { s: Settlement; rank: number }[] = [];
  settlements.forEach((s, i) => {
    const name = normalized[i]!;
    const rank = name === q ? 0 : name.startsWith(q) ? 1 : name.includes(q) ? 2 : -1;
    if (rank >= 0) found.push({ s, rank });
  });
  return found
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        kinds.indexOf(a.s.kind) - kinds.indexOf(b.s.kind) ||
        a.s.name.localeCompare(b.s.name, 'ru'),
    )
    .slice(0, limit)
    .map((f) => f.s);
}

/** Districts of a region, by name. */
export function districtsOf(regionCode: string): District[] {
  return districts
    .filter((d) => d.region.code === regionCode)
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

/** Settlements of a district — or, for a city of republican significance, the city itself. */
export function settlementsOf(place: { district?: string; region?: string }): Settlement[] {
  const list = settlements.filter((s) =>
    place.district ? s.district?.code === place.district : s.region.code === place.region,
  );
  return list.sort(
    (a, b) => kinds.indexOf(a.kind) - kinds.indexOf(b.kind) || a.name.localeCompare(b.name, 'ru'),
  );
}

/** The name of a Населённый пункт, or nothing when it is not named. */
export function settlementName(code: string | undefined): string {
  return code ? (byCode.get(code)?.name ?? '') : '';
}
