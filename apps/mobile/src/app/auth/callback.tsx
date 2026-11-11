import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppText, Button, Screen } from '@/components/ui';
import { completeAuthCallback } from '@/features/auth/auth';
import { colors, spacing } from '@/theme/tokens';

/** Landing route for magic links: stampa://auth/callback */
export default function AuthCallback() {
  const { t } = useTranslation();
  const router = useRouter();
  const url = Linking.useURL();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    completeAuthCallback(url)
      .then(() => !cancelled && router.replace('/profile'))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [url, router]);

  return (
    <Screen>
      <View style={styles.center}>
        {failed ? (
          <>
            <AppText color="textMuted" style={styles.text}>
              {t('auth.failed')}
            </AppText>
            <Button
              label={t('common.close')}
              variant="secondary"
              onPress={() => router.replace('/')}
            />
          </>
        ) : (
          <ActivityIndicator color={colors.accent} accessibilityLabel={t('common.loading')} />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.xxl,
  },
  text: { textAlign: 'center' },
});
