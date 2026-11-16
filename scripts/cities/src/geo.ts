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

// ── First-level regions (provinces/states) ───────────────────────────────────────────────────

export type RegionFeature = { type: 'Feature'; properties: { r: number }; geometry: Geometry };
export type RegionCollection = { type: 'FeatureCollection'; features: RegionFeature[] };

type RawRegion = { properties: Record<string, unknown>; geometry: Geometry | null };
type Box = [number, number, number, number];

function polygonsOf(geometry: Geometry): Position[][][] {
  return geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
}

function boxOf(geometry: Geometry): Box {
  const box: Box = [Infinity, Infinity, -Infinity, -Infinity];
  for (const polygon of polygonsOf(geometry)) {
    for (const [x, y] of polygon[0] ?? []) {
      if (x < box[0]) box[0] = x;
      if (y < box[1]) box[1] = y;
      if (x > box[2]) box[2] = x;
      if (y > box[3]) box[3] = y;
    }
  }
  return box;
}

/** Offsets tried when a (usually coastal) city falls just outside every polygon. */
const NUDGES: [number, number][] = [[0, 0]];
for (const d of [0.04, 0.1, 0.2]) {
  NUDGES.push([d, 0], [-d, 0], [0, d], [0, -d], [d, d], [d, -d], [-d, d], [-d, -d]);
}

/**
 * Finds the province/state polygon of every point (index into the returned collection, or -1)
 * and returns only the polygons that are used, simplified for the app. The lookup runs on the
 * full-resolution geometry so that simplification cannot move a city into a neighbour.
 */
export async function buildRegions(
  naturalEarthAdmin1: string,
  points: { lon: number; lat: number; countryCode: string }[],
): Promise<{ regions: RegionCollection; regionOf: number[] }> {
  const raw = (JSON.parse(naturalEarthAdmin1) as { features: RawRegion[] }).features.filter(
    (f): f is RawRegion & { geometry: Geometry } => f.geometry !== null,
  );
  const boxes = raw.map((f) => boxOf(f.geometry));
  const countryOf = raw.map((f) => String(f.properties.iso_a2 ?? ''));

  const find = (lon: number, lat: number, country: string, sameCountryOnly: boolean): number => {
    for (let i = 0; i < raw.length; i++) {
      if (sameCountryOnly && countryOf[i] !== country) continue;
      const b = boxes[i]!;
      if (lon < b[0] || lon > b[2] || lat < b[1] || lat > b[3]) continue;
      if (polygonsOf(raw[i]!.geometry).some((p) => inPolygon(lon, lat, p))) return i;
    }
    return -1;
  };

  const used = new Map<number, number>(); // raw index → output index
  const regionOf = points.map((p) => {
    let hit = -1;
    for (const [dx, dy] of NUDGES) {
      // Away from the exact spot, only accept the city's own country.
      hit = find(p.lon + dx, p.lat + dy, p.countryCode, dx !== 0 || dy !== 0);
      if (hit !== -1) break;
    }
    if (hit === -1) return -1;
    if (!used.has(hit)) used.set(hit, used.size);
    return used.get(hit)!;
  });

  const input = {
    type: 'FeatureCollection',
    features: [...used].map(([rawIndex, r]) => ({
      type: 'Feature',
      properties: { r },
      geometry: raw[rawIndex]!.geometry,
    })),
  };
  const out = await mapshaper.applyCommands(
    '-i in.geojson -simplify 5% keep-shapes -o precision=0.01 format=geojson out.geojson',
    { 'in.geojson': JSON.stringify(input) },
  );
  const regions = JSON.parse(String(out['out.geojson'])) as RegionCollection;
  regions.features.sort((a, b) => a.properties.r - b.properties.r);
  return { regions, regionOf };
}
