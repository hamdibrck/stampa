import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// mapshaper ships no types; only applyCommands is used.
const mapshaper = require('mapshaper') as {
  applyCommands(cmd: string, input: Record<string, string>): Promise<Record<string, string>>;
};

type Position = [number, number];
type Geometry =
  | { type: 'Polygon'; coordinates: Position[][] }
  | { type: 'MultiPolygon'; coordinates: Position[][][] };
export type CountryFeature = {
  type: 'Feature';
  properties: { iso2: string };
  geometry: Geometry;
};
export type CountryCollection = { type: 'FeatureCollection'; features: CountryFeature[] };

/** Natural Earth uses -99 for some ISO codes; these ADM0_A3 codes fill the gaps. */
const A3_TO_ISO2: Record<string, string> = { KOS: 'XK', NOR: 'NO', FRA: 'FR' };

/** Simplifies Natural Earth admin-0 countries and keeps a single `iso2` property. */
export async function buildCountryGeometry(
  naturalEarthGeoJson: string,
): Promise<CountryCollection> {
  const out = await mapshaper.applyCommands(
    '-i in.geojson -simplify 22% keep-shapes -filter-fields ISO_A2_EH,ISO_A2,ADM0_A3 -o precision=0.01 format=geojson out.geojson',
    { 'in.geojson': naturalEarthGeoJson },
  );
  const raw = JSON.parse(String(out['out.geojson'])) as {
    features: { properties: Record<string, string>; geometry: Geometry | null }[];
  };
  const features: CountryFeature[] = [];
  for (const f of raw.features) {
    if (!f.geometry) continue;
    const p = f.properties;
    const candidates = [p.ISO_A2_EH, p.ISO_A2, A3_TO_ISO2[p.ADM0_A3 ?? '']];
    const iso2 = candidates.find((c) => c && /^[A-Z]{2}$/.test(c)) ?? '';
    features.push({ type: 'Feature', properties: { iso2 }, geometry: f.geometry });
  }
  features.sort((a, b) => a.properties.iso2.localeCompare(b.properties.iso2));
  return { type: 'FeatureCollection', features };
}

function inRing(lon: number, lat: number, ring: Position[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inPolygon(lon: number, lat: number, polygon: Position[][]): boolean {
  const [outer, ...holes] = polygon;
  return !!outer && inRing(lon, lat, outer) && !holes.some((h) => inRing(lon, lat, h));
}

/** ISO2 of the polygon that contains the point, or null. */
export function countryAt(geo: CountryCollection, lon: number, lat: number): string | null {
  for (const f of geo.features) {
    if (!f.properties.iso2) continue;
    const polygons =
      f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    if (polygons.some((p) => inPolygon(lon, lat, p))) return f.properties.iso2;
  }
  return null;
}
