import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard, StyleSheet, View } from 'react-native';

import { AppText, IconButton, Screen } from '@/components/ui';
import type { SearchResult } from '@/data/search';
import { cityById } from '@/data/world';
import { CountriesPanel } from '@/features/home/CountriesPanel';
import { MiniCityCard } from '@/features/home/MiniCityCard';
import { SearchBar, SearchResults } from '@/features/home/SearchBar';
import { WorldCounter } from '@/features/home/WorldCounter';
import { WorldMap, type WorldMapRef } from '@/features/map/WorldMap';
import { useMapStore } from '@/store/map';
import { colors, spacing } from '@/theme/tokens';

const MINI_CARD_SPACE = 96;

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const map = useRef<WorldMapRef>(null);
  const [query, setQuery] = useState('');
  const selectedCityId = useMapStore((s) => s.selectedCityId);
  const select = useMapStore((s) => s.select);
  const focusCity = useMapStore((s) => s.focusCity);
  const focusCountry = useMapStore((s) => s.focusCountry);
  const selectedCity = selectedCityId != null ? cityById.get(selectedCityId) : undefined;
  const searching = query.trim().length > 0;

  const onSelectResult = (result: SearchResult) => {
    Keyboard.dismiss();
    setQuery('');
    if (result.type === 'city') {
      focusCity(result.city.id);
      router.push({ pathname: '/city/[id]', params: { id: String(result.city.id) } });
    } else {
      focusCountry(result.country.iso2);
    }
  };

  return (
    <Screen>
      <View style={styles.top}>
        <View style={styles.header}>
          <AppText variant="title" color="accent" accessibilityRole="header">
            {t('app.name')}
          </AppText>
          <IconButton
            icon="person-circle-outline"
            accessibilityLabel={t('home.openProfile')}
            onPress={() => router.navigate('/profile')}
          />
        </View>
        <WorldCounter />
        <SearchBar value={query} onChange={setQuery} />
      </View>

      <View style={styles.main}>
        <View style={styles.mapArea}>
          <WorldMap ref={map} bottomInset={MINI_CARD_SPACE} />
          <View style={styles.zoom} pointerEvents="box-none">
            <IconButton
              icon="add"
              accessibilityLabel={t('home.zoomIn')}
              onPress={() => map.current?.zoomBy(1)}
            />
            <IconButton
              icon="remove"
              accessibilityLabel={t('home.zoomOut')}
              onPress={() => map.current?.zoomBy(-1)}
            />
          </View>
          {selectedCity ? (
            <View style={styles.miniCard} pointerEvents="box-none">
              <MiniCityCard
                city={selectedCity}
                onClose={() => select(null)}
                onDetail={() =>
                  router.push({ pathname: '/city/[id]', params: { id: String(selectedCity.id) } })
                }
              />
            </View>
          ) : null}
        </View>
        <CountriesPanel
          onOpenCountry={(iso2) => router.push({ pathname: '/country/[iso2]', params: { iso2 } })}
        />
        {searching ? (
          <View style={StyleSheet.absoluteFill}>
            <SearchResults query={query} onSelect={onSelectResult} />
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  main: { flex: 1 },
  mapArea: { flex: 1, backgroundColor: colors.mapOcean, overflow: 'hidden' },
  zoom: { position: 'absolute', right: spacing.md, top: spacing.md, gap: spacing.sm },
  miniCard: { position: 'absolute', left: spacing.md, right: spacing.md, bottom: spacing.md },
});
