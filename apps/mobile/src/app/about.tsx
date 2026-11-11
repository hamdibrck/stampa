import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText, IconButton, Screen } from '@/components/ui';
import { dataVersion, totalCities } from '@/data/world';
import { countLabel } from '@/i18n';
import { colors, radius, spacing } from '@/theme/tokens';

/** About + data attributions (GeoNames is CC BY: attribution is required). */
export default function AboutScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <Screen>
      <View style={styles.header}>
        <IconButton
          icon="chevron-back"
          accessibilityLabel={t('common.back')}
          onPress={() => router.back()}
        />
        <AppText variant="title" accessibilityRole="header">
          {t('about.title')}
        </AppText>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <AppText color="textSoft">{t('about.body')}</AppText>
        <View style={styles.card}>
          <AppText variant="heading">{t('about.dataTitle')}</AppText>
          {(['geonames', 'naturalEarth', 'wikipedia', 'fonts'] as const).map((key) => (
            <AppText key={key} variant="caption" color="textSoft">
              {t(`about.${key}`)}
            </AppText>
          ))}
        </View>
        <AppText variant="caption" color="textMuted">
          {countLabel('city', totalCities)} · {dataVersion}
        </AppText>
      </ScrollView>
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
  content: { padding: spacing.xl, gap: spacing.lg },
  card: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
