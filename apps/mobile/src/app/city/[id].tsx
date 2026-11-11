import { formatDate } from '@stampa/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StampBadge } from '@/components/StampBadge';
import { AppText, Button } from '@/components/ui';
import { cityById, cityName, countryByIso, countryName } from '@/data/world';
import { CommunityCard } from '@/features/city/CommunityCard';
import { fallbackSummary } from '@/features/city/citySummary';
import { PhotoSection } from '@/features/photos/PhotoSection';
import { useCityInfo } from '@/features/stats/useStats';
import { useLocale } from '@/i18n/useLocale';
import { useMapStore } from '@/store/map';
import { useVisits } from '@/store/visits';
import { colors, spacing } from '@/theme/tokens';

/** City detail, presented as a bottom sheet over the map. */
export default function CitySheet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const locale = useLocale();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const city = cityById.get(Number(id));
  const visit = useVisits((s) => s.visits[String(id)]);
  const toggle = useVisits((s) => s.toggle);
  const [stampKey, setStampKey] = useState(0);
  const info = useCityInfo(Number(id));

  useEffect(() => {
    // Keep the map behind the sheet centred on this city.
    const state = useMapStore.getState();
    if (city && state.selectedCityId !== city.id) state.focusCity(city.id);
  }, [city]);

  if (!city) {
    return (
      <View style={styles.missing}>
        <AppText color="textMuted">{t('common.error')}</AppText>
        <Button label={t('common.close')} variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  const visited = visit != null;
  const name = cityName(city, locale);
  const country = countryName(countryByIso.get(city.country), locale);
  const subtitle = [country, city.admin1].filter((p) => p && p !== name).join(' · ');
  const summary =
    (locale === 'tr' ? info.data?.summaryTr : info.data?.summaryEn) ??
    fallbackSummary(city, locale);

  const onToggle = () => {
    if (toggle(city.id)) setStampKey((k) => k + 1);
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.titleRow}>
          <View style={styles.titleText}>
            <AppText variant="title" accessibilityRole="header" testID="city-title">
              {name}
            </AppText>
            <AppText color="textMuted">
              {subtitle}
              {city.isCapital ? ` · ${t('city.capital')}` : ''}
            </AppText>
          </View>
          {visited ? <StampBadge animateKey={stampKey} /> : null}
        </View>

        {visited ? (
          <AppText variant="caption" color="textMuted">
            {t('city.visitedOn', { date: formatDate(visit.visitedAt, locale) })}
          </AppText>
        ) : null}

        <AppText color="textSoft" testID="city-summary">
          {summary}
        </AppText>

        <CommunityCard share={info.data?.share} />
        <PhotoSection city={city} />
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
        <Button
          testID="toggle-visited"
          label={visited ? t('city.unmarkVisited') : t('city.markVisited')}
          variant={visited ? 'secondary' : 'primary'}
          onPress={onToggle}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing.xl, paddingTop: spacing.xxl, gap: spacing.lg },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  titleText: { flex: 1, gap: 2 },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  missing: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    backgroundColor: colors.surface,
  },
});
