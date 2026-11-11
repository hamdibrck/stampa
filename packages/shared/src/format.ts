export type Locale = 'tr' | 'en';

function fixed(value: number, digits: number, locale: Locale): string {
  const s = value.toFixed(digits);
  return locale === 'tr' ? s.replace('.', ',') : s;
}

/** ratio 0..1 → tr "%2,4" / en "2.4%" */
export function formatPercent(ratio: number, locale: Locale, digits = 1): string {
  const safe = Number.isFinite(ratio) ? Math.max(0, ratio) : 0;
  const n = fixed(safe * 100, digits, locale);
  return locale === 'tr' ? `%${n}` : `${n}%`;
}

/** "10/81" */
export function formatFraction(part: number, total: number): string {
  return `${part}/${total}`;
}

/** 1234567 → tr "1.234.567" / en "1,234,567" */
export function formatInteger(value: number, locale: Locale): string {
  const sep = locale === 'tr' ? '.' : ',';
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

/** 15_460_000 → tr "15,5 Mn" / en "15.5M"; 81_000 → tr "81 B" / en "81K" */
export function formatPopulation(value: number, locale: Locale): string {
  if (value >= 1_000_000) {
    const n = fixed(value / 1_000_000, 1, locale);
    return locale === 'tr' ? `${n} Mn` : `${n}M`;
  }
  if (value >= 1_000) {
    const n = Math.round(value / 1_000);
    return locale === 'tr' ? `${n} B` : `${n}K`;
  }
  return String(value);
}
