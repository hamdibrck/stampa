import { formatPopulation, type Locale } from '@stampa/shared';

import { countryByIso, countryName, type City } from '@/data/world';
import i18n from '@/i18n';

/** "Ülke · Bölge · Nüfus" — shown when a city has no encyclopedia summary (or offline). */
export function fallbackSummary(city: City, locale: Locale): string {
  const parts = [countryName(countryByIso.get(city.country), locale), city.admin1];
  if (city.population > 0) {
    parts.push(i18n.t('city.population', { value: formatPopulation(city.population, locale) }));
  }
  return [...new Set(parts.filter(Boolean))].join(' · ');
}
