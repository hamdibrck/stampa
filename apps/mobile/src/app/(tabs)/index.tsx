import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AppText, Screen } from '@/components/ui';
import { spacing } from '@/theme/tokens';

export default function Placeholder() {
  const { t } = useTranslation();
  return (
    <Screen>
      <View style={{ padding: spacing.xl }}>
        <AppText variant="title" accessibilityRole="header">
          {t('tabs.map')}
        </AppText>
      </View>
    </Screen>
  );
}
