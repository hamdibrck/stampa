import { describe, expect, it } from 'vitest';
import { formatFraction, formatInteger, formatPercent, formatPopulation } from './format';
import { ratio } from './progress';

describe('formatPercent', () => {
  it('uses Turkish format', () => {
    expect(formatPercent(0.024, 'tr')).toBe('%2,4');
    expect(formatPercent(10 / 81, 'tr')).toBe('%12,3');
    expect(formatPercent(0, 'tr')).toBe('%0,0');
    expect(formatPercent(0.25, 'tr', 0)).toBe('%25');
  });
  it('uses English format', () => {
    expect(formatPercent(0.024, 'en')).toBe('2.4%');
  });
  it('is safe for bad input', () => {
    expect(formatPercent(NaN, 'tr')).toBe('%0,0');
  });
});

describe('other formatters', () => {
  it('formats fractions', () => expect(formatFraction(10, 81)).toBe('10/81'));
  it('formats integers', () => {
    expect(formatInteger(1234567, 'tr')).toBe('1.234.567');
    expect(formatInteger(1234567, 'en')).toBe('1,234,567');
    expect(formatInteger(999, 'tr')).toBe('999');
  });
  it('formats population', () => {
    expect(formatPopulation(15_460_000, 'tr')).toBe('15,5 Mn');
    expect(formatPopulation(15_460_000, 'en')).toBe('15.5M');
    expect(formatPopulation(81_400, 'tr')).toBe('81 B');
  });
});

describe('ratio', () => {
  it('handles zero totals and clamps', () => {
    expect(ratio(1, 0)).toBe(0);
    expect(ratio(10, 81)).toBeCloseTo(0.12345, 4);
    expect(ratio(5, 4)).toBe(1);
  });
});

describe('formatDate / flagEmoji', () => {
  it('formats dates per locale', async () => {
    const { formatDate } = await import('./format');
    expect(formatDate('2026-11-11', 'tr')).toBe('11.11.2026');
    expect(formatDate('2026-03-05', 'en')).toBe('5 Mar 2026');
  });
  it('builds flag emoji', async () => {
    const { flagEmoji } = await import('./format');
    expect(flagEmoji('TR')).toBe('🇹🇷');
    expect(flagEmoji('x')).toBe('');
  });
});
