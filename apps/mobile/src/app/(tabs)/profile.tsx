import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import type { ComponentProps, ReactNode } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Button, Screen } from '@/components/ui';
import { signOut } from '@/features/auth/auth';
import { deleteAccount } from '@/features/auth/deleteAccount';
import { isPurchasesConfigured, restorePurchases } from '@/features/purchases/purchases';
import { useLocale } from '@/i18n/useLocale';
import { openLink, PRIVACY_URL, TERMS_URL } from '@/lib/links';
import { useSession } from '@/store/session';
import { useSettings } from '@/store/settings';
import { usePendingCount } from '@/store/visits';
import { colors, hitTarget, radius, spacing } from '@/theme/tokens';

type RowProps = {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress?: () => void;
  right?: ReactNode;
  danger?: boolean;
  testID?: string;
};

function Row({ icon, label, onPress, right, danger, testID }: RowProps) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={label}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.textSoft} />
      <AppText variant="bodyMedium" color={danger ? 'danger' : 'text'} style={styles.rowLabel}>
        {label}
      </AppText>
      {right ??
        (onPress ? <Ionicons name="chevron-forward" size={18} color={colors.textMuted} /> : null)}
    </Pressable>
  );
}

export default function ProfileScreen() {
  const { t } = useTranslation();
  const locale = useLocale();
  const router = useRouter();
  const session = useSession((s) => s.session);
  const setLocale = useSettings((s) => s.setLocale);
  const pending = usePendingCount();
  const [busy, setBusy] = useState(false);
  const user = session?.user;

  const onRestore = async () => {
    if (!user) return;
    setBusy(true);
    const ok = await restorePurchases(user.id);
    setBusy(false);
    Alert.alert(t(ok ? 'profile.restored' : 'paywall.unavailable'));
  };

  const onDelete = () => {
    Alert.alert(t('profile.deleteTitle'), t('profile.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.deleteConfirm'),
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          const ok = await deleteAccount();
          setBusy(false);
          if (!ok) Alert.alert(t('profile.deleteFailed'));
        },
      },
    ]);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="title" accessibilityRole="header">
          {t('profile.title')}
        </AppText>

        <View style={styles.card}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={24} color={colors.accent} />
          </View>
          <View style={styles.cardBody}>
            <AppText variant="heading" numberOfLines={1} testID="profile-name">
              {user
                ? ((user.user_metadata?.full_name as string | undefined) ??
                  user.email ??
                  t('profile.title'))
                : t('profile.guest')}
            </AppText>
            <AppText variant="caption" color="textMuted">
              {user
                ? pending > 0
                  ? t('profile.syncPending', { count: pending })
                  : t('profile.synced')
                : t('profile.guestHint')}
            </AppText>
          </View>
        </View>
        {!user ? (
          <Button
            testID="profile-sign-in"
            label={t('profile.signIn')}
            onPress={() => router.push('/sign-in')}
          />
        ) : null}

        <View style={styles.group}>
          <AppText variant="overline" color="textMuted">
            {t('profile.language').toLocaleUpperCase(locale)}
          </AppText>
          <View style={styles.segment} accessibilityRole="radiogroup">
            {(['tr', 'en'] as const).map((code) => {
              const active = locale === code;
              return (
                <Pressable
                  key={code}
                  testID={`locale-${code}`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  onPress={() => setLocale(code)}
                  style={[styles.segmentItem, active && styles.segmentActive]}
                >
                  <AppText variant="label" color={active ? 'onAccent' : 'textSoft'}>
                    {t(code === 'tr' ? 'profile.languageTr' : 'profile.languageEn')}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.list}>
          {user && isPurchasesConfigured ? (
            <Row icon="refresh" label={t('profile.restore')} onPress={() => void onRestore()} />
          ) : null}
          <Row
            icon="shield-checkmark-outline"
            label={t('profile.privacy')}
            onPress={() => openLink(PRIVACY_URL)}
          />
          <Row
            icon="document-text-outline"
            label={t('profile.terms')}
            onPress={() => openLink(TERMS_URL)}
          />
          <Row
            icon="information-circle-outline"
            label={t('profile.about')}
            onPress={() => router.push('/about')}
          />
          {user ? (
            <>
              <Row
                icon="log-out-outline"
                label={t('profile.signOut')}
                onPress={() => void signOut()}
                testID="sign-out"
              />
              <Row
                icon="trash-outline"
                label={t('profile.deleteAccount')}
                onPress={onDelete}
                danger
                testID="delete-account"
              />
            </>
          ) : null}
        </View>

        <AppText variant="caption" color="textMuted" style={styles.version}>
          {t('profile.version', { version: Constants.expoConfig?.version ?? '1.0.0' })}
          {busy ? ' …' : ''}
        </AppText>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.xl, gap: spacing.lg },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1, gap: 2 },
  group: { gap: spacing.sm },
  segment: {
    flexDirection: 'row',
    padding: 4,
    gap: 4,
    borderRadius: radius.button,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentItem: {
    flex: 1,
    minHeight: hitTarget,
    borderRadius: radius.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: { backgroundColor: colors.accent },
  list: {
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
  },
  row: {
    minHeight: hitTarget + 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowLabel: { flex: 1 },
  pressed: { opacity: 0.7 },
  version: { textAlign: 'center' },
});
