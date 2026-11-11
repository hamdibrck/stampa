/**
 * Which GeoNames places count as a "city" in Stampa.
 *
 * This file fixes the denominator of every percentage in the app, so changes here are
 * product decisions (see docs/DECISIONS.md D3). Rules are keyed by ISO 3166-1 alpha-2
 * country code; countries without an entry use DEFAULT_RULE.
 */

export type PopulationRule = {
  kind: 'population';
  /** Minimum population for a place to count. */
  minPopulation: number;
  /** Always include the national capital (PPLC), whatever its population. */
  includeCapital: boolean;
};

export type Admin1CapitalsRule = {
  kind: 'admin1-capitals';
  /**
   * One city per first-level administrative division (province/state): its seat.
   * The city is displayed under the division's name (İzmit → Kocaeli).
   */
  nameFromAdmin1: boolean;
  /** Guard for the pipeline: fail loudly if the data does not yield this many cities. */
  expectedCount?: number;
};

export type CountryRule = PopulationRule | Admin1CapitalsRule;

export const DEFAULT_RULE: PopulationRule = {
  kind: 'population',
  minPopulation: 100_000,
  includeCapital: true,
};

export const COUNTRY_RULES: Record<string, CountryRule> = {
  // Türkiye: the 81 provinces (il), represented by their seats.
  TR: { kind: 'admin1-capitals', nameFromAdmin1: true, expectedCount: 81 },
};

/**
 * Feature codes that never count: sections of a city (PPLX), historical (PPLH),
 * abandoned (PPLQ) and destroyed (PPLW) places.
 */
export const EXCLUDED_FEATURE_CODES = new Set(['PPLX', 'PPLH', 'PPLQ', 'PPLW']);

/** Feature codes that mark the seat of a first-level division. PPLC is also its province's seat. */
export const ADMIN1_SEAT_CODES = new Set(['PPLA', 'PPLC']);

export function ruleFor(
  countryCode: string,
  overrides: Record<string, CountryRule> = COUNTRY_RULES,
): CountryRule {
  return overrides[countryCode] ?? DEFAULT_RULE;
}
