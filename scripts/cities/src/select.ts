import {
  ADMIN1_SEAT_CODES,
  COUNTRY_RULES,
  EXCLUDED_FEATURE_CODES,
  ruleFor,
  type CountryRule,
} from '../rules';
import { trProvince } from './plates';
import type { Admin1Names, GeoNamesCity, SelectedCity } from './types';

export type SelectInput = {
  /** cities15000: the worldwide candidate pool. */
  cities: GeoNamesCity[];
  /** Full per-country dumps, needed for admin1-capitals rules (seats can be under 15k). */
  countryDumps?: Record<string, GeoNamesCity[]>;
  admin1: Admin1Names;
  rules?: Record<string, CountryRule>;
};

function toSelected(c: GeoNamesCity, admin1: Admin1Names): SelectedCity {
  return {
    id: c.geonamesId,
    countryCode: c.countryCode,
    name: c.name,
    asciiName: c.asciiName,
    admin1: admin1.get(`${c.countryCode}.${c.admin1Code}`)?.name ?? null,
    lat: c.lat,
    lon: c.lon,
    population: c.population,
    isCapital: c.featureCode === 'PPLC',
    plateCode: null,
    nameLocked: false,
  };
}

function selectByPopulation(
  pool: GeoNamesCity[],
  rule: Extract<CountryRule, { kind: 'population' }>,
  admin1: Admin1Names,
): SelectedCity[] {
  const usable = pool.filter((c) => !EXCLUDED_FEATURE_CODES.has(c.featureCode));
  const picked = usable.filter(
    (c) => c.population >= rule.minPopulation || (rule.includeCapital && c.featureCode === 'PPLC'),
  );
  // Every country that has any candidate gets at least one city: its largest place.
  if (picked.length === 0 && usable.length > 0) {
    picked.push(usable.reduce((a, b) => (b.population > a.population ? b : a)));
  }
  return picked.map((c) => toSelected(c, admin1));
}

function selectAdmin1Capitals(
  countryCode: string,
  pool: GeoNamesCity[],
  rule: Extract<CountryRule, { kind: 'admin1-capitals' }>,
  admin1: Admin1Names,
): SelectedCity[] {
  const seats = new Map<string, GeoNamesCity>();
  for (const c of pool) {
    if (!ADMIN1_SEAT_CODES.has(c.featureCode) || !c.admin1Code) continue;
    const current = seats.get(c.admin1Code);
    if (!current || c.population > current.population) seats.set(c.admin1Code, c);
  }
  const out = [...seats.values()].map((c) => {
    const city = toSelected(c, admin1);
    if (rule.nameFromAdmin1 && city.admin1) {
      const province = countryCode === 'TR' ? trProvince(city.admin1) : null;
      if (countryCode === 'TR' && !province) {
        throw new Error(`No plate code for TR admin1 "${city.admin1}" (${c.name})`);
      }
      city.nameLocked = true;
      city.name = city.admin1;
      if (province) {
        city.nameTr = province.name;
        city.plateCode = province.plate;
      }
    }
    return city;
  });
  if (rule.expectedCount !== undefined && out.length !== rule.expectedCount) {
    throw new Error(
      `${countryCode}: expected ${rule.expectedCount} admin1 capitals, found ${out.length}`,
    );
  }
  return out;
}

/** Applies the per-country rules. Output is sorted by id so runs are reproducible. */
export function selectCities({
  cities,
  countryDumps = {},
  admin1,
  rules = COUNTRY_RULES,
}: SelectInput): SelectedCity[] {
  const byCountry = new Map<string, GeoNamesCity[]>();
  for (const c of cities) {
    if (!c.countryCode) continue;
    let list = byCountry.get(c.countryCode);
    if (!list) byCountry.set(c.countryCode, (list = []));
    list.push(c);
  }
  for (const code of Object.keys(rules)) if (!byCountry.has(code)) byCountry.set(code, []);

  const out: SelectedCity[] = [];
  for (const [code, pool] of byCountry) {
    const rule = ruleFor(code, rules);
    if (rule.kind === 'population') {
      out.push(...selectByPopulation(pool, rule, admin1));
    } else {
      const dump = countryDumps[code];
      if (!dump) throw new Error(`Rule for ${code} needs the full country dump (${code}.txt)`);
      out.push(...selectAdmin1Capitals(code, dump, rule, admin1));
    }
  }
  return out.sort((a, b) => a.id - b.id);
}
