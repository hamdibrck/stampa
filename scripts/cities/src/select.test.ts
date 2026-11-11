import { describe, expect, it } from 'vitest';

import { DEFAULT_RULE, ruleFor, type CountryRule } from '../rules';
import { TR_PROVINCES, trProvince } from './plates';
import { selectCities } from './select';
import type { Admin1Names, GeoNamesCity } from './types';

let nextId = 1;
function place(p: Partial<GeoNamesCity> & { countryCode: string }): GeoNamesCity {
  return {
    geonamesId: nextId++,
    name: 'X',
    asciiName: 'X',
    lat: 0,
    lon: 0,
    featureCode: 'PPL',
    admin1Code: '01',
    population: 0,
    ...p,
  };
}
const noAdmin1: Admin1Names = new Map();

describe('default rule: population ≥ 100k + capital', () => {
  const cities = [
    place({ countryCode: 'DE', name: 'Big', population: 500_000 }),
    place({ countryCode: 'DE', name: 'Edge', population: 100_000 }),
    place({ countryCode: 'DE', name: 'Small', population: 99_999 }),
    place({ countryCode: 'DE', name: 'Borough', population: 300_000, featureCode: 'PPLX' }),
    place({ countryCode: 'IS', name: 'Tiny capital', population: 20_000, featureCode: 'PPLC' }),
    place({ countryCode: 'FO', name: 'Village', population: 16_000 }),
    place({ countryCode: 'FO', name: 'Largest', population: 19_000 }),
  ];
  const names = selectCities({ cities, admin1: noAdmin1, rules: {} }).map((c) => c.name);

  it('keeps cities at or above the threshold', () => {
    expect(names).toContain('Big');
    expect(names).toContain('Edge');
    expect(names).not.toContain('Small');
  });
  it('excludes sections of cities', () => expect(names).not.toContain('Borough'));
  it('always keeps the capital', () => expect(names).toContain('Tiny capital'));
  it('gives every country at least its largest place', () => {
    expect(names).toContain('Largest');
    expect(names).not.toContain('Village');
  });
  it('flags capitals', () => {
    const out = selectCities({ cities, admin1: noAdmin1, rules: {} });
    expect(out.find((c) => c.name === 'Tiny capital')?.isCapital).toBe(true);
    expect(out.find((c) => c.name === 'Big')?.isCapital).toBe(false);
  });
});

describe('rule overrides', () => {
  it('falls back to the default rule', () => {
    expect(ruleFor('DE')).toBe(DEFAULT_RULE);
    expect(ruleFor('TR').kind).toBe('admin1-capitals');
  });

  it('applies a per-country population override', () => {
    const cities = [
      place({ countryCode: 'NL', name: 'Mid', population: 60_000 }),
      place({ countryCode: 'BE', name: 'MidBE', population: 60_000 }),
      place({ countryCode: 'BE', name: 'BigBE', population: 200_000 }),
    ];
    const rules: Record<string, CountryRule> = {
      NL: { kind: 'population', minPopulation: 50_000, includeCapital: true },
    };
    const names = selectCities({ cities, admin1: noAdmin1, rules }).map((c) => c.name);
    expect(names).toEqual(expect.arrayContaining(['Mid', 'BigBE']));
    expect(names).not.toContain('MidBE');
  });

  it('applies an admin1-capitals rule to another country', () => {
    const dump = [
      place({
        countryCode: 'XX',
        name: 'Seat A',
        featureCode: 'PPLA',
        admin1Code: 'A',
        population: 5_000,
      }),
      place({
        countryCode: 'XX',
        name: 'Seat B',
        featureCode: 'PPLC',
        admin1Code: 'B',
        population: 900_000,
      }),
      place({ countryCode: 'XX', name: 'Huge non-seat', admin1Code: 'A', population: 2_000_000 }),
    ];
    const admin1: Admin1Names = new Map([
      ['XX.A', { name: 'Alpha', asciiName: 'Alpha' }],
      ['XX.B', { name: 'Beta', asciiName: 'Beta' }],
    ]);
    const rules: Record<string, CountryRule> = {
      XX: { kind: 'admin1-capitals', nameFromAdmin1: true, expectedCount: 2 },
    };
    const out = selectCities({ cities: [], countryDumps: { XX: dump }, admin1, rules });
    expect(out.map((c) => c.name).sort()).toEqual(['Alpha', 'Beta']);
    expect(out.every((c) => c.nameLocked)).toBe(true);
  });

  it('fails loudly when the expected count is not met', () => {
    const rules: Record<string, CountryRule> = {
      XX: { kind: 'admin1-capitals', nameFromAdmin1: false, expectedCount: 3 },
    };
    expect(() =>
      selectCities({ cities: [], countryDumps: { XX: [] }, admin1: noAdmin1, rules }),
    ).toThrow(/expected 3/);
  });
});

describe('Türkiye plate codes', () => {
  it('lists 81 unique provinces', () => {
    expect(TR_PROVINCES).toHaveLength(81);
    expect(new Set(TR_PROVINCES).size).toBe(81);
  });
  it('maps names and aliases to plate codes', () => {
    expect(trProvince('Istanbul')).toEqual({ name: 'İstanbul', plate: '34' });
    expect(trProvince('Ankara')?.plate).toBe('06');
    expect(trProvince('Hakkâri')?.plate).toBe('30');
    expect(trProvince('Şanlıurfa')?.plate).toBe('63');
    expect(trProvince('Düzce')?.plate).toBe('81');
    expect(trProvince('İçel')?.plate).toBe('33');
    expect(trProvince('Nowhere')).toBeNull();
  });
});

describe('selection is reproducible', () => {
  it('returns the same ordered result for shuffled input', () => {
    const cities = Array.from({ length: 50 }, (_, i) =>
      place({ countryCode: i % 2 ? 'AA' : 'BB', population: 100_000 + i }),
    );
    const a = selectCities({ cities, admin1: noAdmin1, rules: {} });
    const b = selectCities({ cities: [...cities].reverse(), admin1: noAdmin1, rules: {} });
    expect(b).toEqual(a);
  });
});
