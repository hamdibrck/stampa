import { describe, expect, it } from 'vitest';

import { sentenceCase, shortSummary } from './summary';

describe('shortSummary', () => {
  it('keeps a long first sentence only', () => {
    const intro =
      "Istanbul is the largest city in Turkey, constituting the country's economic, cultural, and historical heart, straddling the Bosporus Strait. With a population over 15 million, it is home to 18% of the population of Turkey.";
    expect(shortSummary(intro)).toBe(
      "Istanbul is the largest city in Turkey, constituting the country's economic, cultural, and historical heart, straddling the Bosporus Strait.",
    );
  });

  it('adds a second sentence when the first is short', () => {
    expect(shortSummary('Rize is a city in Turkey. It is known for its tea. Third sentence.')).toBe(
      'Rize is a city in Turkey. It is known for its tea.',
    );
  });

  it('removes parenthetical noise', () => {
    expect(
      shortSummary(
        'London (/ˈlʌndən/ (listen)) is the capital and largest city of England and the United Kingdom [1].',
      ),
    ).toBe('London is the capital and largest city of England and the United Kingdom.');
  });

  it('does not split on abbreviations followed by lowercase', () => {
    expect(shortSummary('Ankara, approx. 5 million people, is the capital of Türkiye today.')).toBe(
      'Ankara, approx. 5 million people, is the capital of Türkiye today.',
    );
  });

  it('truncates at a word boundary', () => {
    const out = shortSummary(`${'word '.repeat(120)}end.`)!;
    expect(out.length).toBeLessThanOrEqual(321);
    expect(out.endsWith('…')).toBe(true);
  });

  it('returns null for empty or tiny input', () => {
    expect(shortSummary('')).toBeNull();
    expect(shortSummary(null)).toBeNull();
    expect(shortSummary('City.')).toBeNull();
  });
});

describe('sentenceCase', () => {
  it('capitalises with Turkish rules', () => {
    expect(sentenceCase('izmir ilinin merkezi', 'tr')).toBe('İzmir ilinin merkezi');
    expect(sentenceCase('capital of Germany', 'en')).toBe('Capital of Germany');
    expect(sentenceCase('  ', 'en')).toBeNull();
  });
});
