import Ionicons from '@expo/vector-icons/Ionicons';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button, IconButton } from '@/components/ui';
import {
  AuthError,
  isValidEmail,
  sendMagicLink,
  signInWithApple,
  signInWithGoogle,
} from '@/features/auth/auth';
import { isBackendConfigured } from '@/lib/supabase';
import { useUserId } from '@/store/session';
import { colors, fonts, hitTarget, radius, spacing } from '@/theme/tokens';

type Busy = 'apple' | 'google' | 'email' | null;

export default function SignInScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userId = useUserId();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState<Busy>(null);
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(Platform.OS === 'ios');

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    AppleAuthentication.isAvailableAsync()
      .then(setAppleAvailable)
      .catch(() => setAppleAvailable(false));
  }, []);

  // Close as soon as a session exists (also covers the magic-link round trip).
  useEffect(() => {
    if (userId && router.canGoBack()) router.back();
  }, [userId, router]);

  const run = async (kind: Exclude<Busy, null>, action: () => Promise<void>) => {
    setMessage(null);
    setBusy(kind);
    try {
      await action();
    } catch (e) {
      const code = e instanceof AuthError ? e.code : 'failed';
      if (code !== 'cancelled') {
        setMessage({
          kind: 'error',
          text: t(code === 'not-configured' ? 'auth.notConfigured' : 'auth.failed'),
        });
      }
    } finally {
      setBusy(null);
    }
  };

  const onEmail = () => {
    if (!isValidEmail(email)) {
      setMessage({ kind: 'error', text: t('auth.emailInvalid') });
      return;
    }
    void run('email', async () => {
      await sendMagicLink(email);
      setMessage({ kind: 'info', text: t('auth.emailSent', { email: email.trim() }) });
    });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.root}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
      >
        <View style={styles.close}>
          <IconButton
            icon="close"
            accessibilityLabel={t('common.close')}
            onPress={() => router.back()}
          />
        </View>
        <AppText variant="title" accessibilityRole="header">
          {t('auth.title')}
        </AppText>
        <AppText color="textMuted">{t('auth.subtitle')}</AppText>

        {!isBackendConfigured ? (
          <View style={styles.notice}>
            <Ionicons name="information-circle" size={20} color={colors.textMuted} />
            <AppText variant="caption" color="textMuted" style={styles.noticeText}>
              {t('auth.notConfigured')}
            </AppText>
          </View>
        ) : null}

        <View style={styles.buttons}>
          {appleAvailable ? (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
              cornerRadius={radius.button}
              style={styles.apple}
              onPress={() => void run('apple', signInWithApple)}
            />
          ) : null}
          <Button
            testID="google-sign-in"
            label={t('auth.google')}
            variant="secondary"
            loading={busy === 'google'}
            disabled={busy !== null}
            onPress={() => void run('google', signInWithGoogle)}
          />
        </View>

        <View style={styles.divider}>
          <View style={styles.line} />
          <AppText variant="caption" color="textMuted">
            {t('auth.or')}
          </AppText>
          <View style={styles.line} />
        </View>

        <TextInput
          testID="email-input"
          value={email}
          onChangeText={setEmail}
          placeholder={t('auth.emailPlaceholder')}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={t('auth.emailPlaceholder')}
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="send"
          onSubmitEditing={onEmail}
          maxFontSizeMultiplier={1.3}
          style={styles.input}
        />
        <Button
          testID="email-sign-in"
          label={t('auth.emailCta')}
          loading={busy === 'email'}
          disabled={busy !== null}
          onPress={onEmail}
        />

        {message ? (
          <AppText
            testID="auth-message"
            accessibilityLiveRegion="polite"
            color={message.kind === 'error' ? 'danger' : 'textSoft'}
            style={styles.message}
          >
            {message.text}
          </AppText>
        ) : null}

        <AppText variant="caption" color="textMuted" style={styles.legal}>
          {t('auth.legal')}
        </AppText>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl, gap: spacing.md },
  close: { alignItems: 'flex-end' },
  notice: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  noticeText: { flex: 1 },
  buttons: { gap: spacing.md, marginTop: spacing.md },
  apple: { height: hitTarget + 8 },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginVertical: spacing.sm,
  },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  input: {
    minHeight: hitTarget + 8,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 15,
  },
  message: { textAlign: 'center' },
  legal: { textAlign: 'center', marginTop: spacing.md },
});
