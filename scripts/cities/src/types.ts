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
