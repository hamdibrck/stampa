import { flagEmoji, formatFraction } from '@stampa/shared';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, ProgressBar } from '@/components/ui';
import type { CountryProgress } from '@/data/progress';
import { countryName } from '@/data/world';
import { useLocale } from '@/i18n/useLocale';
import { colors, hitTarget, radius, spacing } from '@/theme/tokens';

type Props = { progress: CountryProgress; onPress: () => void };

/** Flag/code, name, `x/y` and a thin progress bar. */
export function CountryRow({ progress, onPress }: Props) {
  const locale = useLocale();
  const { country, visited, total, ratio } = progress;
  const name = countryName(country, locale);
  const fraction = formatFraction(visited, total);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${fraction}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.flag}>
        <AppText style={styles.flagText} maxFontSizeMultiplier={1}>
          {flagEmoji(country.iso2) || country.iso2}
        </AppText>
      </View>
      <View style={styles.body}>
        <View style={styles.line}>
          <AppText variant="bodyMedium" numberOfLines={1} style={styles.name}>
            {name}
          </AppText>
          <AppText variant="number" color="textSoft">
            {fraction}
          </AppText>
        </View>
        <ProgressBar value={ratio} height={4} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: hitTarget + 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  pressed: { opacity: 0.7 },
  flag: {
    width: 40,
    height: 40,
    borderRadius: radius.chip,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flagText: { fontSize: 20, lineHeight: 26 },
  body: { flex: 1, gap: 6 },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  name: { flex: 1 },
});
