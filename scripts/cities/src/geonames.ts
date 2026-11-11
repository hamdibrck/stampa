import type { Admin1Names, GeoNamesCity, GeoNamesCountry } from './types';

/** Parses a GeoNames "geoname" table dump (cities15000.txt, TR.txt, …). Keeps populated places. */
export function parseGeoNames(text: string): GeoNamesCity[] {
  const out: GeoNamesCity[] = [];
  for (const line of text.split('\n')) {
    if (!line) continue;
    const f = line.split('\t');
    if (f[6] !== 'P') continue;
    out.push({
      geonamesId: Number(f[0]),
      name: f[1] ?? '',
      asciiName: f[2] ?? '',
      lat: Number(f[4]),
      lon: Number(f[5]),
      featureCode: f[7] ?? '',
      countryCode: f[8] ?? '',
      admin1Code: f[10] ?? '',
      population: Number(f[14]) || 0,
    });
  }
  return out;
}

export function parseCountryInfo(text: string): GeoNamesCountry[] {
  const out: GeoNamesCountry[] = [];
  for (const line of text.split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const f = line.split('\t');
    if (!f[0] || !f[1]) continue;
    out.push({
      iso2: f[0],
      iso3: f[1],
      name: f[4] ?? f[0],
      capital: f[5] ?? '',
      continent: f[8] ?? '',
      geonamesId: Number(f[16]) || 0,
    });
  }
  return out;
}

export function parseAdmin1(text: string): Admin1Names {
  const map: Admin1Names = new Map();
  for (const line of text.split('\n')) {
    if (!line) continue;
    const [code, name, asciiName] = line.split('\t');
    if (code && name) map.set(code, { name, asciiName: asciiName ?? name });
  }
  return map;
}
