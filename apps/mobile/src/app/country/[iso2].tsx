import Ionicons from '@expo/vector-icons/Ionicons';
import { formatPercent } from '@stampa/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { RingChart } from '@/components/RingChart';
import { AppText, IconButton, Screen } from '@/components/ui';
import {
  byName,
  citiesByCountry,
  cityName,
  countryByIso,
  countryName,
  type City,
} from '@/data/world';
import { useCountryStats } from '@/features/stats/useStats';
import { useLocale } from '@/i18n/useLocale';
import { useVisits } from '@/store/visits';
import { colors, hitTarget, radius, spacing } from '@/theme/tokens';

type Filter = 'all' | 'visited' | 'unvisited';
const FILTERS: { key: Filter; label: 'filterAll' | 'filterVisited' | 'filterUnvisited' }[] = [
  { key: 'all', label: 'filterAll' },
  { key: 'visited', label: 'filterVisited' },
  { key: 'unvisited', label: 'filterUnvisited' },
];

export default function CountryScreen() {
  const { iso2 } = useLocalSearchParams<{ iso2: string }>();
  const { t } = useTranslation();
  const locale = useLocale();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');
  const visits = useVisits((s) => s.visits);
  const stats = useCountryStats(iso2);
  const country = countryByIso.get(iso2);

  const all = useMemo(() => {
    const list = [...(citiesByCountry.get(iso2) ?? [])];
    // Plate order for Türkiye, alphabetical elsewhere.
    return list.sort(
      list[0]?.plate
        ? (a, b) => (a.plate ?? '').localeCompare(b.plate ?? '')
        : byName<City>(locale, (c) => cityName(c, locale)),
    );
  }, [iso2, locale]);

  const visitedCount = all.reduce((n, c) => n + (visits[String(c.id)] ? 1 : 0), 0);
  const total = all.length;
  const ratio = total > 0 ? visitedCount / total : 0;
  const data = all.filter((c) => {
    const v = visits[String(c.id)] != null;
    return filter === 'all' || (filter === 'visited' ? v : !v);
  });
  const average = stats.data?.averageCities;

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton
          icon="chevron-back"
          accessibilityLabel={t('common.back')}
          onPress={() => router.back()}
        />
        <AppText variant="title" accessibilityRole="header" numberOfLines={1} style={styles.title}>
          {countryName(country, locale)}
        </AppText>
      </View>

      <FlatList
        data={data}
        keyExtractor={(c) => String(c.id)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.top}>
            <View style={styles.summary}>
              <RingChart
                value={ratio}
                accessibilityLabel={t('country.citiesOf', { visited: visitedCount, total })}
              >
                <AppText variant="title" testID="country-fraction" maxFontSizeMultiplier={1.1}>
                  {visitedCount}
                  <AppText variant="heading" color="textMuted">{` / ${total}`}</AppText>
                </AppText>
                <AppText variant="caption" color="textMuted">
                  {t('units.cityOther', { count: '' }).trim()}
                </AppText>
              </RingChart>
              <View style={styles.summaryText}>
                <AppText variant="hero" testID="country-percent" maxFontSizeMultiplier={1.1}>
                  {formatPercent(ratio, locale)}
                </AppText>
                {typeof average === 'number' ? (
                  <AppText color="textMuted" testID="country-average">
                    {t('country.userAverage', { count: Math.round(average) })}
                  </AppText>
                ) : null}
              </View>
            </View>
            <View style={styles.chips} accessibilityRole="tablist">
              {FILTERS.map((f) => {
                const active = filter === f.key;
                return (
                  <Pressable
                    key={f.key}
                    testID={`filter-${f.key}`}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    onPress={() => setFilter(f.key)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <AppText
                      variant="label"
                      color={active ? 'onAccent' : 'textSoft'}
                      style={styles.chipText}
                    >
                      {t(`country.${f.label}`)}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          </View>
        }
        ListEmptyComponent={
          <AppText color="textMuted" style={styles.empty}>
            {t(filter === 'visited' ? 'country.emptyVisited' : 'country.emptyUnvisited')}
          </AppText>
        }
        renderItem={({ item }) => {
          const visited = visits[String(item.id)] != null;
          const share = stats.data?.shares[item.id];
          const name = cityName(item, locale);
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${name}, ${t(visited ? 'country.visitedState' : 'country.notVisitedState')}`}
              onPress={() =>
                router.push({ pathname: '/city/[id]', params: { id: String(item.id) } })
              }
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={styles.code}>
                <AppText variant="number" color="textSoft" maxFontSizeMultiplier={1.1}>
                  {item.plate ?? name.slice(0, 2).toLocaleUpperCase(locale)}
                </AppText>
              </View>
              <View style={styles.rowBody}>
                <AppText variant="bodyMedium" numberOfLines={1}>
                  {name}
                </AppText>
                <AppText variant="caption" color="textMuted" numberOfLines={1}>
                  {typeof share === 'number'
                    ? t('city.shareVisited', { percent: formatPercent(share, locale, 0) })
                    : t('city.communityNew')}
                </AppText>
              </View>
              {visited ? (
                <Ionicons name="checkmark-circle" size={26} color={colors.accent} />
              ) : (
                <View style={styles.emptyRing} />
              )}
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  title: { flex: 1 },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  top: { gap: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.md },
  summary: { flexDirection: 'row', alignItems: 'center', gap: spacing.xl },
  summaryText: { flex: 1, gap: 4 },
  chips: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  chip: {
    minHeight: hitTarget,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontSize: 14 },
  empty: { textAlign: 'center', marginTop: spacing.xxl },
  row: {
    minHeight: hitTarget + 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  pressed: { opacity: 0.7 },
  code: {
    width: 40,
    height: 40,
    borderRadius: radius.chip,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1 },
  emptyRing: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    marginRight: 1,
  },
});
