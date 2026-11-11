import Ionicons from '@expo/vector-icons/Ionicons';
import { flagEmoji } from '@stampa/shared';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Keyboard, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/ui';
import { createSearchIndex, search, type SearchResult } from '@/data/search';
import { cities, cityName, countries, countryByIso, countryName } from '@/data/world';
import { countLabel } from '@/i18n';
import { useLocale } from '@/i18n/useLocale';
import { useVisits } from '@/store/visits';
import { colors, fonts, hitTarget, radius, spacing } from '@/theme/tokens';

let sharedIndex: ReturnType<typeof createSearchIndex> | null = null;
/** Built on first use so it never delays the first frame. */
const getIndex = () => (sharedIndex ??= createSearchIndex(cities, countries));

type BarProps = { value: string; onChange: (text: string) => void };

export function SearchBar({ value, onChange }: BarProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.bar}>
      <Ionicons name="search" size={18} color={colors.textMuted} />
      <TextInput
        testID="search-input"
        value={value}
        onChangeText={onChange}
        placeholder={t('home.searchPlaceholder')}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={t('home.searchPlaceholder')}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        clearButtonMode="never"
        maxFontSizeMultiplier={1.3}
        style={styles.input}
      />
      {value.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('home.clearSearch')}
          hitSlop={12}
          onPress={() => {
            onChange('');
            Keyboard.dismiss();
          }}
        >
          <Ionicons name="close-circle" size={20} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

type ResultsProps = { query: string; onSelect: (result: SearchResult) => void };

export function SearchResults({ query, onSelect }: ResultsProps) {
  const { t } = useTranslation();
  const locale = useLocale();
  const visits = useVisits((s) => s.visits);
  const results = useMemo(() => search(getIndex(), query, 30), [query]);

  return (
    <FlatList
      testID="search-results"
      data={results}
      keyExtractor={(r) => r.key}
      keyboardShouldPersistTaps="handled"
      style={styles.results}
      contentContainerStyle={styles.resultsContent}
      ListEmptyComponent={
        <AppText color="textMuted" style={styles.empty}>
          {t('home.noResults')}
        </AppText>
      }
      renderItem={({ item }) => {
        const isCity = item.type === 'city';
        const iso2 = isCity ? item.city.country : item.country.iso2;
        const title = isCity ? cityName(item.city, locale) : countryName(item.country, locale);
        const subtitle = isCity
          ? [countryName(countryByIso.get(iso2), locale), item.city.admin1]
              .filter((part) => part && part !== title)
              .join(' · ')
          : countLabel('city', item.country.cityCount);
        const visited = isCity && visits[String(item.city.id)] != null;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${title}, ${subtitle}`}
            onPress={() => onSelect(item)}
            style={({ pressed }) => [styles.result, pressed && styles.pressed]}
          >
            <View style={styles.resultIcon}>
              {isCity ? (
                <Ionicons
                  name="location"
                  size={18}
                  color={visited ? colors.accent : colors.pinUnvisited}
                />
              ) : (
                <AppText maxFontSizeMultiplier={1} style={styles.flag}>
                  {flagEmoji(iso2) || iso2}
                </AppText>
              )}
            </View>
            <View style={styles.resultBody}>
              <AppText variant="bodyMedium" numberOfLines={1}>
                {title}
              </AppText>
              <AppText variant="caption" color="textMuted" numberOfLines={1}>
                {subtitle}
              </AppText>
            </View>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: hitTarget + 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: { flex: 1, color: colors.text, fontFamily: fonts.body, fontSize: 15, paddingVertical: 10 },
  results: { flex: 1, backgroundColor: colors.bg },
  resultsContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  empty: { textAlign: 'center', marginTop: spacing.xxl },
  result: {
    minHeight: hitTarget + 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  pressed: { opacity: 0.7 },
  resultIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.chip,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flag: { fontSize: 18, lineHeight: 24 },
  resultBody: { flex: 1 },
});
