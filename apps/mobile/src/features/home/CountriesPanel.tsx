import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { CountryRow } from '@/components/CountryRow';
import { AppText } from '@/components/ui';
import { countryProgress } from '@/data/progress';
import { useVisits, visitedIds } from '@/store/visits';
import { colors, hitTarget, radius, spacing } from '@/theme/tokens';

type Props = { onOpenCountry: (iso2: string) => void };

const ROW_HEIGHT = 60;

/** "Ülkelerin": countries with at least one stamp, most complete first. Expands over the map. */
export function CountriesPanel({ onOpenCountry }: Props) {
  const { t } = useTranslation();
  const { height } = useWindowDimensions();
  const [expanded, setExpanded] = useState(false);
  const visits = useVisits((s) => s.visits);
  const rows = useMemo(
    () =>
      countryProgress(visitedIds(visits))
        .filter((p) => p.visited > 0)
        .sort((a, b) => b.visited - a.visited || b.ratio - a.ratio),
    [visits],
  );
  const collapsedRows = Math.min(rows.length, 2);
  const listHeight = expanded
    ? Math.min(rows.length * ROW_HEIGHT, height * 0.42)
    : collapsedRows * ROW_HEIGHT;
  const canExpand = rows.length > 2;

  return (
    <View style={styles.panel}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('home.yourCountries')}
        accessibilityState={{ expanded }}
        disabled={!canExpand}
        onPress={() => setExpanded((v) => !v)}
        style={styles.header}
      >
        <AppText variant="heading">{t('home.yourCountries')}</AppText>
        <View style={styles.headerRight}>
          <AppText variant="number" color="textMuted">
            {rows.length}
          </AppText>
          {canExpand ? (
            <Ionicons
              name={expanded ? 'chevron-down' : 'chevron-up'}
              size={18}
              color={colors.textMuted}
            />
          ) : null}
        </View>
      </Pressable>
      {rows.length === 0 ? (
        <AppText variant="caption" color="textMuted" style={styles.empty}>
          {t('home.noCountriesYet')}
        </AppText>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(p) => p.country.iso2}
          scrollEnabled={expanded}
          style={{ height: listHeight }}
          getItemLayout={(_, index) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index })}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <CountryRow progress={item} onPress={() => onOpenCountry(item.country.iso2)} />
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xs,
  },
  header: {
    minHeight: hitTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  empty: { paddingBottom: spacing.md },
  row: { height: ROW_HEIGHT, justifyContent: 'center' },
});
