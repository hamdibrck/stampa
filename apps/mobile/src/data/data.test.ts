import { formatFraction, formatPercent } from '@stampa/shared';

import {
  countryProgress,
  progressForCountry,
  visitedPolygons,
  visitedRegions,
  worldProgress,
} from './progress';
import { createSearchIndex, search } from './search';
import { cities, citiesByCountry, cityById, countries, countryByIso, totalCities } from './world';

const turkey = citiesByCountry.get('TR') ?? [];

describe('embedded dataset', () => {
  it('contains a plausible number of unique cities', () => {
    expect(totalCities).toBeGreaterThan(5000);
    expect(totalCities).toBeLessThan(8000);
    expect(cityById.size).toBe(totalCities);
  });

  it('has exactly 81 Turkish cities, one per province, with plate codes 01–81', () => {
    expect(turkey).toHaveLength(81);
    expect(countryByIso.get('TR')?.cityCount).toBe(81);
    const plates = turkey.map((c) => c.plate).sort();
    expect(plates).toEqual(Array.from({ length: 81 }, (_, i) => String(i + 1).padStart(2, '0')));
  });

  it('names Turkish cities after their province', () => {
    const names = turkey.map((c) => c.nameTr);
    expect(names).toEqual(expect.arrayContaining(['İstanbul', 'Kocaeli', 'Hatay', 'Sakarya']));
    expect(names).not.toContain('İzmit');
  });

  it('keeps country city counts consistent with the city list', () => {
    for (const country of countries) {
      expect(citiesByCountry.get(country.iso2)?.length ?? 0).toBe(country.cityCount);
    }
    expect(countries.reduce((n, c) => n + c.cityCount, 0)).toBe(totalCities);
  });

  it('has valid coordinates', () => {
    for (const c of cities) {
      expect(Math.abs(c.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(c.lon)).toBeLessThanOrEqual(180);
    }
  });
});

describe('progress', () => {
  it('counts Türkiye out of 81', () => {
    const visited = turkey.slice(0, 10).map((c) => c.id);
    const tr = progressForCountry('TR', visited)!;
    expect(formatFraction(tr.visited, tr.total)).toBe('10/81');
    expect(formatPercent(tr.ratio, 'tr')).toBe('%12,3');
  });

  it('computes the world share from the city count', () => {
    const paris = cities.find((c) => c.nameEn === 'Paris' && c.country === 'FR')!;
    const visited = [...turkey.slice(0, 3).map((c) => c.id), paris.id];
    const world = worldProgress(visited);
    expect(world.visitedCities).toBe(4);
    expect(world.visitedCountries).toBe(2);
    expect(world.totalCities).toBe(totalCities);
    expect(world.ratio).toBeCloseTo(4 / totalCities, 10);
  });

  it('is zero for no visits and ignores unknown ids', () => {
    expect(worldProgress([])).toMatchObject({ visitedCities: 0, visitedCountries: 0, ratio: 0 });
    expect(worldProgress([-1, 999999999]).visitedCities).toBe(0);
  });

  it('updates when a visit is added and removed', () => {
    const id = turkey[0]!.id;
    const before = progressForCountry('TR', [])!.visited;
    expect(progressForCountry('TR', [id])!.visited).toBe(before + 1);
    expect(progressForCountry('TR', [])!.visited).toBe(before);
  });

  it('reports every country', () => {
    expect(countryProgress([])).toHaveLength(countries.length);
  });

  it('gives every Turkish city its own province polygon', () => {
    const regions = turkey.map((c) => c.region);
    expect(regions.every((r) => r >= 0)).toBe(true);
    expect(new Set(regions).size).toBe(81);
  });

  it('paints only the regions of visited cities', () => {
    const [a, b] = turkey;
    expect(visitedRegions([])).toEqual([]);
    expect(visitedRegions([a!.id])).toEqual([a!.region]);
    expect(visitedRegions([a!.id, b!.id, -5]).sort()).toEqual([a!.region, b!.region].sort());
  });

  it('paints the polygon of each visited country', () => {
    expect(visitedPolygons([turkey[0]!.id])).toEqual(['TR']);
    expect(visitedPolygons([])).toEqual([]);
  });
});

describe('search', () => {
  const index = createSearchIndex(cities, countries);
  const first = (q: string) => search(index, q)[0];
  const cityOf = (q: string) => {
    const r = first(q);
    return r?.type === 'city' ? r.city : undefined;
  };

  it('ignores Turkish dotted/dotless i', () => {
    expect(cityOf('istanbul')?.nameTr).toBe('İstanbul');
    expect(cityOf('ISTANBUL')?.nameTr).toBe('İstanbul');
    expect(cityOf('ıstanbul')?.nameTr).toBe('İstanbul');
  });

  it('ignores accents', () => {
    expect(cityOf('sao paulo')?.nameEn).toBe('São Paulo');
    expect(cityOf('sanliurfa')?.nameTr).toBe('Şanlıurfa');
  });

  it('matches prefixes and ranks bigger cities first', () => {
    expect(cityOf('istan')?.nameTr).toBe('İstanbul');
    const results = search(index, 'san', 10);
    expect(results.length).toBeGreaterThan(3);
  });

  it('finds countries in both languages', () => {
    const tr = first('türkiye') ?? first('turkiye');
    expect(tr).toMatchObject({ type: 'country', country: { iso2: 'TR' } });
    const de = first('germany');
    expect(de).toMatchObject({ type: 'country', country: { iso2: 'DE' } });
  });

  it('returns nothing for empty or unmatched queries', () => {
    expect(search(index, '   ')).toEqual([]);
    expect(search(index, 'zzzzqqqq')).toEqual([]);
  });

  it('respects the limit', () => {
    expect(search(index, 'a', 5)).toHaveLength(5);
  });
});
