import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  type CameraRef,
  type FilterSpecification,
  type GeoJSONSourceRef,
  type PressEventWithFeatures,
  type StyleSpecification,
  type ViewStateChangeEvent,
} from '@maplibre/maplibre-react-native';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import type { NativeSyntheticEvent } from 'react-native';
import { StyleSheet, View } from 'react-native';

import { visitedPolygons } from '@/data/progress';
import { useLocale } from '@/i18n/useLocale';
import { useMapStore } from '@/store/map';
import { useVisits, visitedIds } from '@/store/visits';
import { colors } from '@/theme/tokens';

import { allCitiesCollection, cityCollection, countriesGeo } from './mapData';

const MAPTILER_KEY = process.env.EXPO_PUBLIC_MAPTILER_KEY;
const MIN_ZOOM = 0.6;
const MAX_ZOOM = 11;

/**
 * The basemap is fully local (docs/DECISIONS.md D1): an ocean background plus country polygons
 * from the embedded Natural Earth data. No tiles, key or network are needed. Text needs glyphs
 * from a font server, so labels are only added when a MapTiler key is configured.
 */
const baseStyle: StyleSpecification = {
  version: 8,
  ...(MAPTILER_KEY
    ? { glyphs: `https://api.maptiler.com/fonts/{fontstack}/{range}.pbf?key=${MAPTILER_KEY}` }
    : {}),
  sources: {},
  layers: [{ id: 'ocean', type: 'background', paint: { 'background-color': colors.mapOcean } }],
};

export type WorldMapRef = { zoomBy: (delta: number) => void };

type Props = {
  /** Extra bottom padding (pt) so a focused city is not hidden behind overlays. */
  bottomInset?: number;
};

export const WorldMap = forwardRef<WorldMapRef, Props>(function WorldMap({ bottomInset = 0 }, ref) {
  const camera = useRef<CameraRef>(null);
  const citySource = useRef<GeoJSONSourceRef>(null);
  const zoom = useRef(1.3);
  const locale = useLocale();

  const visits = useVisits((s) => s.visits);
  const selectedCityId = useMapStore((s) => s.selectedCityId);
  const command = useMapStore((s) => s.command);
  const select = useMapStore((s) => s.select);

  const ids = useMemo(() => visitedIds(visits), [visits]);
  const visitedCollection = useMemo(() => cityCollection(ids), [ids]);
  const visitedCountries = useMemo(() => visitedPolygons(ids), [ids]);
  // An impossible code keeps the filter valid (and the layers empty) before the first stamp.
  const visitedCountryFilter = useMemo<FilterSpecification>(
    () => [
      'in',
      ['get', 'iso2'],
      ['literal', visitedCountries.length > 0 ? visitedCountries : ['--']],
    ],
    [visitedCountries],
  );
  // Grey pins are hidden under stamped cities, so the stamp colour is never muddied.
  const unvisitedPinFilter = useMemo<FilterSpecification>(
    () => [
      'all',
      ['!', ['has', 'point_count']],
      ['!', ['in', ['get', 'id'], ['literal', ids.length > 0 ? ids : [-1]]]],
    ],
    [ids],
  );
  const selectedCollection = useMemo(
    () => cityCollection(selectedCityId ? [selectedCityId] : []),
    [selectedCityId],
  );

  useImperativeHandle(ref, () => ({
    zoomBy: (delta) => {
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom.current + delta));
      camera.current?.zoomTo(next, { duration: 250 });
    },
  }));

  useEffect(() => {
    if (!command) return;
    const padding = { top: 24, left: 24, right: 24, bottom: 24 + bottomInset };
    if (command.kind === 'center') {
      camera.current?.flyTo({
        center: command.center,
        zoom: command.zoom,
        duration: 900,
        padding,
      });
    } else {
      camera.current?.fitBounds(command.bounds, { duration: 900, padding });
    }
    // Only a new command (nonce) should move the camera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command?.nonce]);

  const onRegionDidChange = (e: NativeSyntheticEvent<ViewStateChangeEvent>) => {
    zoom.current = e.nativeEvent.zoom;
  };

  const onCityPress = async (e: NativeSyntheticEvent<PressEventWithFeatures>) => {
    e.stopPropagation();
    const feature = e.nativeEvent.features[0];
    const props = feature?.properties as
      { id?: number; cluster?: boolean; cluster_id?: number } | undefined;
    if (!feature || !props) return;
    if (props.cluster && props.cluster_id != null && feature.geometry.type === 'Point') {
      const [lon, lat] = feature.geometry.coordinates as [number, number];
      const target = await citySource.current
        ?.getClusterExpansionZoom(props.cluster_id)
        .catch(() => zoom.current + 2);
      camera.current?.easeTo({
        center: [lon, lat],
        zoom: Math.min(MAX_ZOOM, (target ?? zoom.current + 2) + 0.3),
        duration: 450,
      });
      return;
    }
    if (typeof props.id === 'number') select(props.id);
  };

  const nameKey = locale === 'tr' ? 'tr' : 'en';

  return (
    <View style={styles.root}>
      <Map
        testID="world-map"
        style={styles.map}
        mapStyle={baseStyle}
        logo={false}
        compass={false}
        attribution={!!MAPTILER_KEY}
        touchRotate={false}
        touchPitch={false}
        onPress={() => select(null)}
        onRegionDidChange={onRegionDidChange}
      >
        <Camera
          ref={camera}
          initialViewState={{ center: [24, 30], zoom: 1.3 }}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
        />

        <GeoJSONSource id="countries" data={countriesGeo} tolerance={0.2}>
          <Layer
            id="country-fill"
            type="fill"
            paint={{
              'fill-color':
                visitedCountries.length > 0
                  ? [
                      'match',
                      ['get', 'iso2'],
                      visitedCountries,
                      colors.mapLandVisited,
                      colors.mapLand,
                    ]
                  : colors.mapLand,
            }}
          />
          <Layer
            id="country-line"
            type="line"
            paint={{ 'line-color': colors.mapBorder, 'line-width': 0.7 }}
          />
          {/* Visited countries: accent tint and outline on top of the lighter land colour. */}
          <Layer
            id="country-visited-tint"
            type="fill"
            filter={visitedCountryFilter}
            paint={{ 'fill-color': colors.accent, 'fill-opacity': 0.16 }}
          />
          <Layer
            id="country-visited-line"
            type="line"
            filter={visitedCountryFilter}
            paint={{ 'line-color': colors.accent, 'line-width': 1.2, 'line-opacity': 0.75 }}
          />
        </GeoJSONSource>

        <GeoJSONSource
          id="cities"
          ref={citySource}
          data={allCitiesCollection}
          cluster
          clusterRadius={42}
          clusterMaxZoom={5}
          onPress={onCityPress}
        >
          <Layer
            id="city-clusters"
            type="circle"
            filter={['has', 'point_count']}
            paint={{
              'circle-color': colors.pinUnvisited,
              'circle-opacity': 0.28,
              'circle-stroke-color': colors.pinUnvisited,
              'circle-stroke-opacity': 0.7,
              'circle-stroke-width': 1,
              'circle-radius': [
                'step',
                ['get', 'point_count'],
                9,
                10,
                12,
                50,
                16,
                200,
                21,
                600,
                27,
              ],
            }}
          />
          {MAPTILER_KEY ? (
            <Layer
              id="city-cluster-count"
              type="symbol"
              filter={['has', 'point_count']}
              layout={{
                'text-field': ['get', 'point_count_abbreviated'],
                'text-font': ['Noto Sans Regular'],
                'text-size': 11,
                'text-allow-overlap': true,
              }}
              paint={{ 'text-color': colors.text }}
            />
          ) : null}
          <Layer
            id="city-pins"
            type="circle"
            filter={unvisitedPinFilter}
            paint={{
              'circle-color': colors.pinUnvisited,
              'circle-stroke-color': colors.mapOcean,
              'circle-stroke-width': 1,
              'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 2.5, 5, 4, 9, 6],
            }}
          />
          {MAPTILER_KEY ? (
            <Layer
              id="city-labels"
              type="symbol"
              minzoom={5}
              filter={['!', ['has', 'point_count']]}
              layout={{
                'text-field': ['get', nameKey],
                'text-font': ['Noto Sans Regular'],
                'text-size': 11,
                'text-offset': [0, 0.9],
                'text-anchor': 'top',
                'text-optional': true,
              }}
              paint={{
                'text-color': colors.textSoft,
                'text-halo-color': colors.mapOcean,
                'text-halo-width': 1,
              }}
            />
          ) : null}
        </GeoJSONSource>

        {/* Visited cities are never clustered, so stamps stay visible at every zoom level. */}
        <GeoJSONSource id="visited-cities" data={visitedCollection} onPress={onCityPress}>
          <Layer
            id="visited-glow"
            type="circle"
            paint={{
              'circle-color': colors.accent,
              'circle-opacity': 0.28,
              'circle-blur': 0.6,
              'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 9, 5, 14, 9, 20],
            }}
          />
          <Layer
            id="visited-pins"
            type="circle"
            paint={{
              'circle-color': colors.accent,
              'circle-stroke-color': colors.text,
              'circle-stroke-width': 1.5,
              'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 4.5, 5, 6.5, 9, 9],
            }}
          />
        </GeoJSONSource>

        <GeoJSONSource id="selected-city" data={selectedCollection}>
          <Layer
            id="selected-ring"
            type="circle"
            paint={{
              'circle-color': 'rgba(0,0,0,0)',
              'circle-stroke-color': colors.text,
              'circle-stroke-width': 2,
              'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 8, 9, 13],
            }}
          />
        </GeoJSONSource>
      </Map>
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.mapOcean },
  map: { flex: 1 },
});
