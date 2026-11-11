import type { Feature, FeatureCollection, Point } from 'geojson';

import { cities, cityById } from '@/data/world';

export const countriesGeo = require('../../../assets/data/countries.geo.json') as FeatureCollection;

export type CityProps = { id: number; tr: string; en: string };

function feature(id: number): Feature<Point, CityProps> | null {
  const c = cityById.get(id);
  if (!c) return null;
  return {
    type: 'Feature',
    id: c.id,
    properties: { id: c.id, tr: c.nameTr, en: c.nameEn },
    geometry: { type: 'Point', coordinates: [c.lon, c.lat] },
  };
}

/** Every city, built once. Clustered natively by the map. */
export const allCitiesCollection: FeatureCollection<Point, CityProps> = {
  type: 'FeatureCollection',
  features: cities.map((c) => feature(c.id)!),
};

/** Small collection that changes on every stamp; cheap to hand to the map again. */
export function cityCollection(ids: number[]): FeatureCollection<Point, CityProps> {
  return {
    type: 'FeatureCollection',
    features: ids.map(feature).filter((f): f is Feature<Point, CityProps> => f !== null),
  };
}
