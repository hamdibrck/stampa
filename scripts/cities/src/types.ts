/** A populated place as read from a GeoNames dump. */
export type GeoNamesCity = {
  geonamesId: number;
  name: string;
  asciiName: string;
  lat: number;
  lon: number;
  featureCode: string;
  countryCode: string;
  admin1Code: string;
  population: number;
};

export type GeoNamesCountry = {
  iso2: string;
  iso3: string;
  name: string;
  capital: string;
  continent: string;
  geonamesId: number;
};

/** admin1 key is "<country>.<admin1Code>", e.g. "TR.34". */
export type Admin1Names = Map<string, { name: string; asciiName: string }>;

export type SelectedCity = {
  id: number;
  countryCode: string;
  /** Name from GeoNames (or the admin1 name when the rule says so). */
  name: string;
  asciiName: string;
  admin1: string | null;
  lat: number;
  lon: number;
  population: number;
  isCapital: boolean;
  /** Licence-plate style code, only for countries that have one (TR). */
  plateCode: string | null;
  /** True when `name` is the admin1 name and must not be replaced by a Wikidata label. */
  nameLocked: boolean;
  /** Turkish display name when known from the rule itself. */
  nameTr?: string;
};

export type Enrichment = {
  qid: string | null;
  labelTr: string | null;
  labelEn: string | null;
  descriptionTr: string | null;
  descriptionEn: string | null;
  summaryTr: string | null;
  summaryEn: string | null;
};

export type City = SelectedCity & {
  nameTr: string;
  nameEn: string;
  summaryTr: string | null;
  summaryEn: string | null;
};

export type Country = {
  iso2: string;
  iso3: string;
  nameTr: string;
  nameEn: string;
  cityCount: number;
  /** ISO2 of the map polygon that represents this country (GF → FR), or null. */
  geomRef: string | null;
};
