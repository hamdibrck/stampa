import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { StampBadge } from '@/components/StampBadge';
import { AppText, IconButton } from '@/components/ui';
import { cityName, countryByIso, countryName, type City } from '@/data/world';
import { useLocale } from '@/i18n/useLocale';
import { useIsVisited } from '@/store/visits';
import { colors, hitTarget, radius, spacing } from '@/theme/tokens';

type Props = { city: City; onDetail: () => void; onClose: () => void };

/** Card for the selected city at the bottom of the map, with a "Detay" button. */
export function MiniCityCard({ city, onDetail, onClose }: Props) {
  const { t } = useTranslation();
  const locale = useLocale();
  const visited = useIsVisited(city.id);
  const name = cityName(city, locale);
  const country = countryName(countryByIso.get(city.country), locale);
  const subtitle = [country, city.admin1].filter((p) => p && p !== name).join(' · ');

  return (
    <View testID="mini-city-card" style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${subtitle}. ${t('home.detail')}`}
        onPress={onDetail}
        style={styles.body}
      >
        <View style={styles.titleRow}>
          <AppText variant="heading" numberOfLines={1} style={styles.title}>
            {name}
          </AppText>
          {visited ? <StampBadge size="sm" /> : null}
        </View>
        <AppText variant="caption" color="textMuted" numberOfLines={1}>
          {subtitle}
        </AppText>
      </Pressable>
      <Pressable
        testID="mini-card-detail"
        accessibilityRole="button"
        accessibilityLabel={t('home.detail')}
        onPress={onDetail}
        style={({ pressed }) => [styles.detail, pressed && styles.pressed]}
      >
        <AppText variant="label" color="onAccent">
          {t('home.detail')}
        </AppText>
      </Pressable>
      <IconButton
        icon="close"
        size={18}
        filled={false}
        color="textMuted"
        accessibilityLabel={t('home.closeCard')}
        onPress={onClose}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.lg,
    paddingRight: spacing.xs,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  body: { flex: 1, minHeight: hitTarget, justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flexShrink: 1 },
  detail: {
    minHeight: hitTarget,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.button,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.85 },
});
