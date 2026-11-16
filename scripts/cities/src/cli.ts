import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { COUNTRY_RULES } from '../rules';
import {
  buildCityBundle,
  buildCountries,
  buildCountryBundle,
  buildSeedSql,
  mergeCities,
} from './emit';
import { enrichCities } from './enrich';
import { buildCountryGeometry, buildRegions } from './geo';
import { parseAdmin1, parseCountryInfo, parseGeoNames } from './geonames';
import { CACHE, download, REPO, ROOT } from './http';
import { selectCities } from './select';
import type { Enrichment, SelectedCity } from './types';
import { turkishCountryNames } from './wikidata';

const GEONAMES = 'https://download.geonames.org/export/dump';
const NATURAL_EARTH_ADMIN1 =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson';
const NATURAL_EARTH =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson';

const OUT = join(ROOT, 'out');
const APP_DATA = join(REPO, 'apps', 'mobile', 'assets', 'data');
const SEED = join(REPO, 'supabase', 'seed');

const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;
const writeJson = (path: string, data: unknown, pretty = false) =>
  writeFileSync(path, JSON.stringify(data, null, pretty ? 2 : undefined) + '\n');

async function unzipped(name: string): Promise<string> {
  const txt = join(CACHE, 'geonames', `${name}.txt`);
  if (!existsSync(txt)) {
    const zip = await download(`${GEONAMES}/${name}.zip`, `geonames/${name}.zip`);
    execFileSync('unzip', ['-o', '-q', zip, `${name}.txt`, '-d', join(CACHE, 'geonames')]);
  }
  return txt;
}

async function stepDownload() {
  await unzipped('cities15000');
  for (const code of Object.keys(COUNTRY_RULES)) await unzipped(code);
  await download(`${GEONAMES}/countryInfo.txt`, 'geonames/countryInfo.txt');
  await download(`${GEONAMES}/admin1CodesASCII.txt`, 'geonames/admin1CodesASCII.txt');
  await download(NATURAL_EARTH, 'naturalearth/ne_50m_admin_0_countries.geojson');
  await download(NATURAL_EARTH_ADMIN1, 'naturalearth/ne_10m_admin_1_states_provinces.geojson');
  console.log('download: ok');
}

async function stepSelect(): Promise<SelectedCity[]> {
  const cities = parseGeoNames(readFileSync(await unzipped('cities15000'), 'utf8'));
  const countryDumps: Record<string, ReturnType<typeof parseGeoNames>> = {};
  for (const [code, rule] of Object.entries(COUNTRY_RULES)) {
    if (rule.kind === 'admin1-capitals') {
      countryDumps[code] = parseGeoNames(readFileSync(await unzipped(code), 'utf8'));
    }
  }
  const admin1 = parseAdmin1(readFileSync(join(CACHE, 'geonames', 'admin1CodesASCII.txt'), 'utf8'));
  const selected = selectCities({ cities, countryDumps, admin1 });
  mkdirSync(OUT, { recursive: true });
  writeJson(join(OUT, 'selected.json'), selected);
  console.log(`select: ${selected.length} cities`);
  return selected;
}

async function stepEnrich() {
  const selected = readJson<SelectedCity[]>(join(OUT, 'selected.json'));
  const enrichment = await enrichCities(selected);
  writeJson(join(OUT, 'enrichment.json'), Object.fromEntries(enrichment));
  writeJson(join(OUT, 'country-names-tr.json'), Object.fromEntries(await turkishCountryNames()));
  console.log('enrich: ok');
}

async function stepEmit() {
  const selected = readJson<SelectedCity[]>(join(OUT, 'selected.json'));
  const enrichmentPath = join(OUT, 'enrichment.json');
  const enrichment = new Map<number, Enrichment>(
    existsSync(enrichmentPath)
      ? Object.entries(readJson<Record<string, Enrichment>>(enrichmentPath)).map(([k, v]) => [
          Number(k),
          v,
        ])
      : [],
  );
  if (enrichment.size === 0) console.warn('emit: no enrichment found, names/summaries fall back');
  const trNamesPath = join(OUT, 'country-names-tr.json');
  const trNames = new Map<string, string>(
    existsSync(trNamesPath) ? Object.entries(readJson<Record<string, string>>(trNamesPath)) : [],
  );

  const cities = mergeCities(selected, enrichment);
  const geo = await buildCountryGeometry(
    readFileSync(join(CACHE, 'naturalearth', 'ne_50m_admin_0_countries.geojson'), 'utf8'),
  );
  const infos = parseCountryInfo(readFileSync(join(CACHE, 'geonames', 'countryInfo.txt'), 'utf8'));
  const countries = buildCountries(infos, cities, trNames, geo);

  mkdirSync(APP_DATA, { recursive: true });
  mkdirSync(SEED, { recursive: true });
  const { regions, regionOf } = await buildRegions(
    readFileSync(join(CACHE, 'naturalearth', 'ne_10m_admin_1_states_provinces.geojson'), 'utf8'),
    cities,
  );
  writeJson(join(APP_DATA, 'cities.v1.json'), buildCityBundle(cities, regionOf));
  writeJson(join(APP_DATA, 'regions.geo.json'), regions);
  writeJson(join(APP_DATA, 'countries.v1.json'), buildCountryBundle(countries, cities));
  writeJson(join(APP_DATA, 'countries.geo.json'), geo);
  const sql = buildSeedSql(countries, cities);
  writeFileSync(join(SEED, '01_countries.sql'), sql.countries);
  writeFileSync(join(SEED, '02_cities.sql'), sql.cities);

  const report = {
    cities: cities.length,
    countriesWithCities: countries.filter((c) => c.cityCount > 0).length,
    turkey: cities.filter((c) => c.countryCode === 'TR').length,
    regions: regions.features.length,
    citiesWithoutRegion: regionOf.filter((r) => r === -1).length,
    turkeyRegions: new Set(cities.flatMap((c, i) => (c.countryCode === 'TR' ? [regionOf[i]] : [])))
      .size,
    capitals: cities.filter((c) => c.isCapital).length,
    withWikidata: [...enrichment.values()].filter((e) => e.qid).length,
    withSummaryTr: cities.filter((c) => c.summaryTr).length,
    withSummaryEn: cities.filter((c) => c.summaryEn).length,
    turkishNameDiffers: cities.filter((c) => c.nameTr !== c.nameEn).length,
    countriesWithoutPolygon: countries
      .filter((c) => c.cityCount > 0 && !c.geomRef)
      .map((c) => c.iso2),
  };
  writeJson(join(OUT, 'report.json'), report, true);
  console.log('emit:', JSON.stringify(report, null, 2));
}

const steps: Record<string, () => Promise<unknown>> = {
  download: stepDownload,
  select: stepSelect,
  enrich: stepEnrich,
  emit: stepEmit,
  all: async () => {
    await stepDownload();
    await stepSelect();
    await stepEnrich();
    await stepEmit();
  },
};

const step = steps[process.argv[2] ?? 'all'];
if (!step) {
  console.error(`Unknown step. Use one of: ${Object.keys(steps).join(', ')}`);
  process.exit(1);
}
await step();
