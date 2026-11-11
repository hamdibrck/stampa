import { formatPercent } from '@stampa/shared';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, ProgressBar } from '@/components/ui';
import { worldProgress } from '@/data/progress';
import { countLabel } from '@/i18n';
import { useLocale } from '@/i18n/useLocale';
import { useVisits, visitedIds } from '@/store/visits';
import { spacing } from '@/theme/tokens';

/** "%2,4 dünyanın gezilen kısmı · 34 şehir · 9 ülke" + progress bar. */
export function WorldCounter() {
  const { t } = useTranslation();
  const locale = useLocale();
  const visits = useVisits((s) => s.visits);
  const world = useMemo(() => worldProgress(visitedIds(visits)), [visits]);
  const percent = formatPercent(world.ratio, locale);
  const counts = `${countLabel('city', world.visitedCities)} · ${countLabel('country', world.visitedCountries)}`;

  return (
    <View
      accessible
      accessibilityLabel={`${percent} ${t('home.worldVisited')}. ${counts}`}
      style={styles.root}
    >
      <View style={styles.row}>
        <AppText variant="hero" testID="world-percent" maxFontSizeMultiplier={1.15}>
          {percent}
        </AppText>
        <View style={styles.meta}>
          <AppText variant="caption" color="textMuted" numberOfLines={1}>
            {t('home.worldVisited')}
          </AppText>
          <AppText variant="number" color="textSoft" testID="world-counts" numberOfLines={1}>
            {counts}
          </AppText>
        </View>
      </View>
      <ProgressBar value={world.ratio} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md },
  meta: { flex: 1, paddingBottom: 6 },
});
