import { normalizeSearch } from '@stampa/shared';

import type { City, Country } from './world';

export type SearchResult =
  { type: 'city'; city: City; key: string } | { type: 'country'; country: Country; key: string };

type Entry = { keys: string[]; weight: number; result: SearchResult };

export type SearchIndex = Entry[];

const uniqueKeys = (...names: string[]) => [...new Set(names.map(normalizeSearch))];

export function createSearchIndex(cities: City[], countries: Country[]): SearchIndex {
  const index: SearchIndex = [];
  for (const country of countries) {
    index.push({
      keys: uniqueKeys(country.nameTr, country.nameEn),
      // Countries outrank cities of the same match quality.
      weight: 1e10 + country.cityCount,
      result: { type: 'country', country, key: `country:${country.iso2}` },
    });
  }
  for (const city of cities) {
    index.push({
      keys: uniqueKeys(city.nameTr, city.nameEn),
      weight: city.population,
      result: { type: 'city', city, key: `city:${city.id}` },
    });
  }
  return index;
}

/** 0 exact, 1 prefix, 2 prefix of a later word, 3 substring; -1 no match. */
function rank(key: string, q: string): number {
  if (key === q) return 0;
  if (key.startsWith(q)) return 1;
  if (key.includes(` ${q}`)) return 2;
  if (q.length >= 3 && key.includes(q)) return 3;
  return -1;
}

/**
 * Accent- and Turkish-insensitive search over cities and countries.
 * Better matches first, then bigger places.
 */
export function search(index: SearchIndex, query: string, limit = 20): SearchResult[] {
  const q = normalizeSearch(query);
  if (!q) return [];
  const hits: { r: number; entry: Entry }[] = [];
  for (const entry of index) {
    let best = -1;
    for (const key of entry.keys) {
      const r = rank(key, q);
      if (r !== -1 && (best === -1 || r < best)) best = r;
    }
    if (best !== -1) hits.push({ r: best, entry });
  }
  hits.sort((a, b) => a.r - b.r || b.entry.weight - a.entry.weight);
  return hits.slice(0, limit).map((h) => h.entry.result);
}
