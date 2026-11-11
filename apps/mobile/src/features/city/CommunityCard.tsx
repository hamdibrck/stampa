import Ionicons from '@expo/vector-icons/Ionicons';
import { formatPercent } from '@stampa/shared';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { useLocale } from '@/i18n/useLocale';
import { colors, radius, spacing } from '@/theme/tokens';

type Props = { share: number | null | undefined };

/**
 * "Kullanıcıların %25'i gezdi". When fewer than 20 users have visited, the server hides the
 * number (k-anonymity) and this shows "Yeni keşif" instead.
 */
export function CommunityCard({ share }: Props) {
  const { t } = useTranslation();
  const locale = useLocale();
  const hasShare = typeof share === 'number';
  return (
    <View style={styles.card} accessible>
      <View style={styles.icon}>
        <Ionicons name={hasShare ? 'people' : 'sparkles'} size={20} color={colors.accent} />
      </View>
      <View style={styles.body}>
        <AppText variant="overline" color="textMuted">
          {t('city.communityTitle').toLocaleUpperCase(locale)}
        </AppText>
        {hasShare ? (
          <AppText variant="bodyMedium" testID="community-share">
            {t('city.communityShare', {
              percent: formatPercent(share, locale, share < 0.1 ? 1 : 0),
            })}
          </AppText>
        ) : (
          <>
            <AppText variant="bodyMedium" testID="community-new">
              {t('city.communityNew')}
            </AppText>
            <AppText variant="caption" color="textMuted">
              {t('city.communityNewHint')}
            </AppText>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface2,
    borderRadius: radius.card,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 2 },
});
