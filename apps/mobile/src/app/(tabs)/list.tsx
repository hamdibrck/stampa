import Ionicons from '@expo/vector-icons/Ionicons';
import { flagEmoji, formatDate, formatFraction } from '@stampa/shared';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, SectionList, StyleSheet, View } from 'react-native';

import { AppText, Button, Screen } from '@/components/ui';
import {
  cityById,
  cityName,
  countryByIso,
  countryName,
  type City,
  type Country,
} from '@/data/world';
import { useLocale } from '@/i18n/useLocale';
import { useVisits } from '@/store/visits';
import type { Visits } from '@/sync/merge';
import { colors, hitTarget, radius, spacing } from '@/theme/tokens';

type Item = { city: City; visitedAt: string; updatedAt: string };
type Section = { country: Country; latest: string; data: Item[] };

/** Visited cities grouped by country; groups and cities ordered by visit date. */
export function buildSections(visits: Visits, newestFirst: boolean): Section[] {
  const dir = newestFirst ? -1 : 1;
  const stamp = (i: Item) => `${i.visitedAt}|${i.updatedAt}`;
  const groups = new Map<string, Item[]>();
  for (const [id, visit] of Object.entries(visits)) {
    const city = cityById.get(Number(id));
    if (!city) continue;
    const list = groups.get(city.country) ?? [];
    list.push({ city, visitedAt: visit.visitedAt, updatedAt: visit.updatedAt });
    groups.set(city.country, list);
  }
  const sections: Section[] = [];
  for (const [iso2, items] of groups) {
    const country = countryByIso.get(iso2);
    if (!country) continue;
    items.sort((a, b) => dir * stamp(a).localeCompare(stamp(b)));
    sections.push({ country, latest: stamp(items[0]!), data: items });
  }
  return sections.sort((a, b) => dir * a.latest.localeCompare(b.latest));
}

export default function ListScreen() {
  const { t } = useTranslation();
  const locale = useLocale();
  const router = useRouter();
  const visits = useVisits((s) => s.visits);
  const [newestFirst, setNewestFirst] = useState(true);
  const sections = useMemo(() => buildSections(visits, newestFirst), [visits, newestFirst]);
  // Countries are listed collapsed; a country's cities open like a dropdown.
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const visible = useMemo(
    () =>
      sections.map((s) => ({
        ...s,
        count: s.data.length,
        data: expanded[s.country.iso2] ? s.data : [],
      })),
    [sections, expanded],
  );
  const toggle = (iso2: string) => setExpanded((prev) => ({ ...prev, [iso2]: !prev[iso2] }));

  return (
    <Screen>
      <View style={styles.header}>
        <AppText variant="title" accessibilityRole="header">
          {t('list.title')}
        </AppText>
        {sections.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(newestFirst ? 'list.sortRecent' : 'list.sortOldest')}
            onPress={() => setNewestFirst((v) => !v)}
            style={styles.sort}
          >
            <AppText variant="label" color="textSoft" style={styles.sortText}>
              {t(newestFirst ? 'list.sortRecent' : 'list.sortOldest')}
            </AppText>
          </Pressable>
        ) : null}
      </View>

      {sections.length === 0 ? (
        <View style={styles.empty}>
          <AppText color="textMuted" style={styles.center}>
            {t('list.empty')}
          </AppText>
          <Button label={t('list.emptyCta')} onPress={() => router.navigate('/')} />
        </View>
      ) : (
        <SectionList
          sections={visible}
          keyExtractor={(item) => String(item.city.id)}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => {
            const open = !!expanded[section.country.iso2];
            return (
              <Pressable
                testID={`list-country-${section.country.iso2}`}
                accessibilityRole="button"
                accessibilityLabel={countryName(section.country, locale)}
                accessibilityState={{ expanded: open }}
                onPress={() => toggle(section.country.iso2)}
                style={({ pressed }) => [styles.section, pressed && styles.pressed]}
              >
                <AppText variant="heading" numberOfLines={1} style={styles.sectionTitle}>
                  {flagEmoji(section.country.iso2)} {countryName(section.country, locale)}
                </AppText>
                <AppText variant="number" color="textMuted">
                  {formatFraction(section.count, section.country.cityCount)}
                </AppText>
                <Ionicons
                  name={open ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={colors.textMuted}
                />
              </Pressable>
            );
          }}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={cityName(item.city, locale)}
              onPress={() =>
                router.push({ pathname: '/city/[id]', params: { id: String(item.city.id) } })
              }
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={styles.dot} />
              <AppText variant="bodyMedium" numberOfLines={1} style={styles.rowName}>
                {cityName(item.city, locale)}
              </AppText>
              <AppText variant="caption" color="textMuted">
                {formatDate(item.visitedAt, locale)}
              </AppText>
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  sort: {
    minHeight: hitTarget,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
  },
  sortText: { fontSize: 13 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
    padding: spacing.xxl,
  },
  center: { textAlign: 'center' },
  list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
  section: {
    minHeight: hitTarget + 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  sectionTitle: { flex: 1 },
  row: {
    minHeight: hitTarget + 4,
    paddingLeft: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  pressed: { opacity: 0.7 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  rowName: { flex: 1 },
});
