import countryData from './countries.json';
import nationalityData from './nationalities.json';
import { isSettlementCode, normalizeName, settlementByCode } from './settlements';

/**
 * Национальность: the BNS list of ethnic groups (data/ethnicities/), most numerous first and
 * «Другая национальность» last. A nationality is its 3-digit BNS code.
 */
const rawNationalities = nationalityData as unknown as {
  edition: string;
  nationalities: [string, string][];
};
export const nationalitiesEdition = rawNationalities.edition;
export const nationalities = rawNationalities.nationalities.map(([code, name]) => ({ code, name }));
const nationalityNames = new Map(rawNationalities.nationalities);
export const nationalityCodes = nationalities.map((n) => n.code);
export const isNationalityCode = (code: string) => nationalityNames.has(code);
export const nationalityName = (code: string) => nationalityNames.get(code) ?? '';

/** Nationalities matching a query by name, in list order; all of them for an empty query. */
export function searchNationalities(query: string) {
  const q = normalizeName(query);
  return q ? nationalities.filter((n) => normalizeName(n.name).includes(q)) : nationalities;
}

/** Countries other than Kazakhstan (ISO 3166-1 alpha-2), by Russian name. */
const rawCountries = countryData as unknown as { countries: [string, string][] };
export const countries = rawCountries.countries.map(([code, name]) => ({ code, name }));
const countryNames = new Map(rawCountries.countries);
export const isCountryCode = (code: string) => countryNames.has(code);

/**
 * «Где ты живёшь»: a Населённый пункт of Kazakhstan (its KATO code) or another country (its
 * ISO code). The codes never collide: KATO codes are digits, ISO codes letters.
 */
export const isPlaceCode = (code: string) => isSettlementCode(code) || isCountryCode(code);

export function placeName(code: string | undefined): string {
  if (!code) return '';
  return settlementByCode(code)?.name ?? countryNames.get(code) ?? '';
}

/** Countries whose name matches a query, exact and starting matches first. */
export function searchCountries(query: string, limit = 10) {
  const q = normalizeName(query);
  if (q.length < 2) return [];
  return countries
    .map((c) => {
      const name = normalizeName(c.name);
      return { c, rank: name === q ? 0 : name.startsWith(q) ? 1 : name.includes(q) ? 2 : -1 };
    })
    .filter((f) => f.rank >= 0)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, limit)
    .map((f) => f.c);
}

/** The first Населённый пункт of Kazakhstan among places: the city of the profile. */
export const firstSettlement = (places: readonly string[]) => places.find(isSettlementCode);
