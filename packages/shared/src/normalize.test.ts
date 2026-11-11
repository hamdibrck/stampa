import { describe, expect, it } from 'vitest';
import { normalizeSearch } from './normalize';

describe('normalizeSearch', () => {
  it.each([
    ['İstanbul', 'istanbul'],
    ['ISTANBUL', 'istanbul'],
    ['ıstanbul', 'istanbul'],
    ['São Paulo', 'sao paulo'],
    ['Iğdır', 'igdir'],
    ['Şanlıurfa', 'sanliurfa'],
    ['Çanakkale', 'canakkale'],
    ['Zürich', 'zurich'],
    ['Łódź', 'lodz'],
    ['Saint-Étienne', 'saint etienne'],
    ["N'Djamena", 'n djamena'],
    ['  Kahramanmaraş  ', 'kahramanmaras'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeSearch(input)).toBe(expected);
  });

  it('makes typed queries match stored names', () => {
    expect(normalizeSearch('istanbul')).toBe(normalizeSearch('İstanbul'));
    expect(normalizeSearch('sao paulo')).toBe(normalizeSearch('São Paulo'));
  });
});
