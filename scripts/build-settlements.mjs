// Builds src/catalogs/settlements.json — every city, town (посёлок) and village of Kazakhstan
// with its region and district — from the official KATO in data/kato/. Run after a new
// KATO edition: node scripts/build-settlements.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const SOURCE = 'data/kato/kato-2026-11-04.csv';
const EDITION = '2026-11-04';
const OUT = 'src/catalogs/settlements.json';

/** Cities of republican significance: each is a region and a settlement of its own. */
const REPUBLICAN = new Set(['71', '75', '79']);

function parseCsv(text) {
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line) continue;
    const cells = [];
    let cell = '';
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (quoted) {
        if (ch === '"' && line[i + 1] === '"') {
          cell += '"';
          i++;
        } else if (ch === '"') quoted = false;
        else cell += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ',') {
        cells.push(cell);
        cell = '';
      } else cell += ch;
    }
    cells.push(cell);
    rows.push(cells);
  }
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()])));
}

const rows = parseCsv(readFileSync(SOURCE, 'utf8'));

// «г.Астана» → «Астана»; «область Абай» stays as it is.
const regionName = (name) => name.replace(/^г\.\s*/, '');
// «Семей Г.А.» is the territory administered by the city: «Семей (городская администрация)».
const districtName = (name) =>
  name.endsWith('Г.А.') ? `${name.replace(/\s*Г\.А\.$/, '')} (городская администрация)` : name;

const regions = [];
const regionIndex = new Map();
const districts = [];
const districtIndex = new Map();
for (const r of rows) {
  if (r.cd === '00' && r.ef === '00' && r.hij === '000') {
    regionIndex.set(r.ab, regions.length);
    regions.push([r.ab, regionName(r.rus_name)]);
  }
}
for (const r of rows) {
  if (r.cd !== '00' && r.ef === '00' && r.hij === '000' && !REPUBLICAN.has(r.ab)) {
    districtIndex.set(r.ab + r.cd, districts.length);
    districts.push([r.ab + r.cd, districtName(r.rus_name), regionIndex.get(r.ab)]);
  }
}

// 0 город, 1 посёлок, 2 село. Rural okrugs («с.о.»), winterings, farms and stations are not
// places people live in in a sense a profile needs.
const TYPES = { г: 0, п: 1, с: 2 };
const settlements = [];
for (const r of rows) {
  if (REPUBLICAN.has(r.ab)) {
    if (r.cd === '00') settlements.push([r.te, regionName(r.rus_name), 0, -1, regionIndex.get(r.ab)]);
    continue;
  }
  if (r.cd === '00') continue;
  const m = /^(г|п|с)\.\s*(.+)$/.exec(r.rus_name);
  if (!m || /^о\./.test(m[2]) || r.rus_name.startsWith('с.о')) continue;
  const district = districtIndex.get(r.ab + r.cd);
  if (district === undefined) continue;
  settlements.push([r.te, m[2].trim(), TYPES[m[1]], district, regionIndex.get(r.ab)]);
}

writeFileSync(
  OUT,
  `${JSON.stringify({
    source: 'КАТО НК РК 11-2025, Бюро национальной статистики, stat.gov.kz',
    edition: EDITION,
    regions,
    districts,
    settlements,
  })}\n`,
);
console.log(
  `written ${OUT}: ${regions.length} regions, ${districts.length} districts, ${settlements.length} settlements`,
);
