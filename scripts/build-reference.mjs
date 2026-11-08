// Builds the Анкета's reference lists:
//   src/catalogs/nationalities.json — from the BNS ethnic list in data/ethnicities/;
//   src/catalogs/countries.json — ISO 3166-1 countries with their Russian names from
//   Unicode CLDR (the Intl data shipped with Node), Kazakhstan left out: its places come
//   from KATO.
// Run after a new BNS edition or a Node upgrade: node scripts/build-reference.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const ETHNIC_SOURCE = 'data/ethnicities/bns-ethnicities-2026-01-01.csv';
const ETHNIC_EDITION = '2026-01-01';

// BNS codes that are not an ethnic group of their own.
const NOT_STATED = '190';
const OTHER = '199';

const rows = readFileSync(ETHNIC_SOURCE, 'utf8')
  .trim()
  .split(/\r?\n/)
  .slice(1)
  .map((line) => {
    const [code, name, population] = line.split(',');
    return { code, name, population: Number(population) };
  });

// Most numerous first, as people look for their own; «Другая национальность» last.
// Two spellings of the source fixed: «Латышы» and «Саха(Якуты)».
const SPELLING = { '010': 'Латыши', '054': 'Саха (якуты)' };

const nationalities = rows
  .filter((r) => r.code !== NOT_STATED && r.code !== OTHER)
  .sort((a, b) => b.population - a.population)
  .map((r) => [r.code, SPELLING[r.code] ?? r.name]);
nationalities.push([OTHER, 'Другая национальность']);

writeFileSync(
  'src/catalogs/nationalities.json',
  JSON.stringify({ edition: ETHNIC_EDITION, nationalities }) + '\n',
);

// ISO 3166-1 alpha-2, all 249 officially assigned codes.
const ISO = `AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO
BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO
DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW
GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ
LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX
MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO
RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL
TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW`
  .split(/\s+/)
  .filter(Boolean);
if (ISO.length !== 249) throw new Error(`Expected 249 ISO codes, got ${ISO.length}`);

// CLDR gives a few abbreviations; the Анкета spells them out.
const SPELLED = { AE: 'Объединённые Арабские Эмираты', US: 'Соединённые Штаты' };

const names = new Intl.DisplayNames(['ru'], { type: 'region', fallback: 'none' });
const countries = ISO.filter((code) => code !== 'KZ')
  .map((code) => {
    const cldr = names.of(code);
    if (!cldr) throw new Error(`No Russian name for ${code}`);
    const name = (SPELLED[code] ?? cldr)
      .replace(/^о-в /, 'Остров ')
      .replace(/^о-ва /, 'Острова ')
      .replace(/ о-ва(?= |$)/, ' острова')
      .replace('Св. ', 'Святой ')
      .replace(' (САР)', '');
    return [code, name];
  })
  .sort((a, b) => a[1].localeCompare(b[1], 'ru'));

writeFileSync(
  'src/catalogs/countries.json',
  JSON.stringify({ standard: 'ISO 3166-1', countries }) + '\n',
);

console.log(`written ${nationalities.length} nationalities, ${countries.length} countries`);
