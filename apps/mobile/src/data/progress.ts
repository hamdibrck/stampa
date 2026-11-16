import { ratio } from '@stampa/shared';

import { cityById, countries, totalCities, type City, type Country } from './world';

export type WorldProgress = {
  visitedCities: number;
  totalCities: number;
  visitedCountries: number;
  /** visited cities / all cities (docs/DECISIONS.md D4) */
  ratio: number;
};

export type CountryProgress = {
  country: Country;
  visited: number;
  total: number;
  ratio: number;
};

type Lookup = { cityById: Map<number, City>; countries: Country[]; totalCities: number };
const embedded: Lookup = { cityById, countries, totalCities };

function countByCountry(visitedIds: Iterable<number>, lookup: Lookup): Map<string, number> {
  const counts = new Map<string, number>();
  for (const id of visitedIds) {
    const city = lookup.cityById.get(id);
    // Ids that are no longer in the dataset do not count towards any percentage.
    if (city) counts.set(city.country, (counts.get(city.country) ?? 0) + 1);
  }
  return counts;
}

export function worldProgress(visitedIds: Iterable<number>, lookup = embedded): WorldProgress {
  const counts = countByCountry(visitedIds, lookup);
  let visitedCities = 0;
  for (const n of counts.values()) visitedCities += n;
  return {
    visitedCities,
    totalCities: lookup.totalCities,
    visitedCountries: counts.size,
    ratio: ratio(visitedCities, lookup.totalCities),
  };
}

/** Progress for every country, e.g. Türkiye 10/81. */
export function countryProgress(
  visitedIds: Iterable<number>,
  lookup = embedded,
): CountryProgress[] {
  const counts = countByCountry(visitedIds, lookup);
  return lookup.countries.map((country) => {
    const visited = counts.get(country.iso2) ?? 0;
    return { country, visited, total: country.cityCount, ratio: ratio(visited, country.cityCount) };
  });
}

export function progressForCountry(
  iso2: string,
  visitedIds: Iterable<number>,
  lookup = embedded,
): CountryProgress | null {
  return countryProgress(visitedIds, lookup).find((p) => p.country.iso2 === iso2) ?? null;
}

/** ISO2 codes of the map polygons to paint as visited. */
export function visitedPolygons(visitedIds: Iterable<number>, lookup = embedded): string[] {
  const counts = countByCountry(visitedIds, lookup);
  const byIso = new Map(lookup.countries.map((c) => [c.iso2, c]));
  const out = new Set<string>();
  for (const iso of counts.keys()) {
    const ref = byIso.get(iso)?.geomRef;
    if (ref) out.add(ref);
  }
  return [...out].sort();
}

/** Province/state polygons to paint: the regions of the visited cities. */
export function visitedRegions(visitedIds: Iterable<number>, lookup = embedded): number[] {
  const out = new Set<number>();
  for (const id of visitedIds) {
    const region = lookup.cityById.get(id)?.region;
    if (region !== undefined && region >= 0) out.add(region);
  }
  return [...out].sort((a, b) => a - b);
}
