import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, Screen } from '@/components/ui';
import { colors, radius, spacing } from '@/theme/tokens';

/** v1 placeholder: ratings, comments and trip ideas arrive in v2. */
export default function ExploreScreen() {
  const { t } = useTranslation();
  return (
    <Screen>
      <View style={styles.header}>
        <AppText variant="title" accessibilityRole="header">
          {t('explore.title')}
        </AppText>
      </View>
      <View style={styles.body}>
        <View style={styles.badge}>
          <Ionicons name="compass" size={40} color={colors.accent} />
        </View>
        <AppText variant="heading" style={styles.center}>
          {t('explore.comingSoon')}
        </AppText>
        <AppText color="textMuted" style={styles.center}>
          {t('explore.body')}
        </AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
    gap: spacing.md,
  },
  badge: {
    width: 88,
    height: 88,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  center: { textAlign: 'center' },
});
