import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button } from '@/components/ui';
import { cityById, cityName } from '@/data/world';
import { usePhotos, useQuota } from '@/features/photos/photos';
import { FREE_PHOTOS } from '@/features/photos/PhotoSection';
import {
  loadOffer,
  purchaseCityPack,
  purchasePlus,
  restorePurchases,
} from '@/features/purchases/purchases';
import { useLocale } from '@/i18n/useLocale';
import { openLink, TERMS_URL } from '@/lib/links';
import { useUserId } from '@/store/session';
import { colors, hitTarget, radius, spacing } from '@/theme/tokens';

type Choice = 'cityPack' | 'plus';

/** Paywall sheet: shown when the photo quota for a city is used up. */
export default function PaywallSheet() {
  const { city: cityParam } = useLocalSearchParams<{ city: string }>();
  const { t } = useTranslation();
  const locale = useLocale();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userId = useUserId();
  const city = cityById.get(Number(cityParam));
  const cityId = city?.id ?? 0;
  const photos = usePhotos(userId, cityId);
  const quota = useQuota(userId, cityId);
  const offer = useQuery({
    queryKey: ['offer', userId],
    queryFn: loadOffer,
    staleTime: 5 * 60 * 1000,
  });
  const [choice, setChoice] = useState<Choice>('plus');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!city) return null;
  const name = cityName(city, locale);
  const selected = choice === 'plus' ? offer.data?.plus : offer.data?.cityPack;
  const unavailable = !offer.isLoading && !offer.data?.plus && !offer.data?.cityPack;
  const onlyFree = (quota.data?.quota ?? FREE_PHOTOS) === FREE_PHOTOS;

  const onContinue = async () => {
    if (!userId || !selected) return;
    setBusy(true);
    setMessage(null);
    const result =
      choice === 'plus'
        ? await purchasePlus(userId, city.id, selected)
        : await purchaseCityPack(userId, city.id, selected);
    setBusy(false);
    if (result === 'purchased') router.back();
    else if (result === 'pending') setMessage(t('paywall.pending'));
    else if (result === 'failed') setMessage(t('paywall.failed'));
  };

  const onRestore = async () => {
    if (!userId) return;
    setBusy(true);
    const ok = await restorePurchases(userId, city.id);
    setBusy(false);
    setMessage(t(ok ? 'profile.restored' : 'paywall.unavailable'));
  };

  const options: {
    key: Choice;
    title: string;
    body: string;
    price: string | null;
    badge?: string;
  }[] = [
    {
      key: 'cityPack',
      title: t('paywall.cityPack'),
      body: t('paywall.cityPackBody', { city: name }),
      price: offer.data?.cityPack?.product.priceString ?? null,
    },
    {
      key: 'plus',
      title: t('paywall.plus'),
      body: t('paywall.plusBody'),
      price: offer.data?.plus
        ? t('paywall.perYear', { price: offer.data.plus.product.priceString })
        : null,
      badge: t('paywall.recommended'),
    },
  ];

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.thumbs}>
          {(photos.data ?? []).slice(0, 2).map((p) => (
            <Image
              key={p.id}
              source={{ uri: p.url, cacheKey: p.path }}
              style={styles.thumb}
              contentFit="cover"
            />
          ))}
          <View style={[styles.thumb, styles.plusSlot]}>
            <Ionicons name="add" size={26} color={colors.accent} />
          </View>
        </View>

        <AppText variant="title" accessibilityRole="header" testID="paywall-title">
          {onlyFree
            ? t('paywall.title', { city: name, count: FREE_PHOTOS })
            : t('paywall.titleQuota', { city: name })}
        </AppText>

        <View accessibilityRole="radiogroup" style={styles.options}>
          {options.map((o) => {
            const active = choice === o.key;
            return (
              <Pressable
                key={o.key}
                testID={`paywall-option-${o.key}`}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${o.title}. ${o.body} ${o.price ?? ''}`}
                onPress={() => setChoice(o.key)}
                style={[styles.option, active && styles.optionActive]}
              >
                <View style={styles.optionBody}>
                  <View style={styles.optionTitle}>
                    <AppText variant="heading">{o.title}</AppText>
                    {o.badge ? (
                      <View style={styles.badge}>
                        <AppText variant="overline" color="onAccent">
                          {o.badge.toLocaleUpperCase(locale)}
                        </AppText>
                      </View>
                    ) : null}
                  </View>
                  <AppText variant="caption" color="textMuted">
                    {o.body}
                  </AppText>
                  {o.price ? (
                    <AppText variant="number" color="textSoft">
                      {o.price}
                    </AppText>
                  ) : null}
                </View>
                <Ionicons
                  name={active ? 'radio-button-on' : 'radio-button-off'}
                  size={22}
                  color={active ? colors.accent : colors.textMuted}
                />
              </Pressable>
            );
          })}
        </View>

        {choice === 'plus' ? (
          <AppText variant="caption" color="textMuted">
            {t('paywall.subscriptionNote')}
          </AppText>
        ) : null}
        {unavailable ? (
          <AppText variant="caption" color="textMuted" testID="paywall-unavailable">
            {t('paywall.unavailable')}
          </AppText>
        ) : null}
        {message ? (
          <AppText color="textSoft" accessibilityLiveRegion="polite">
            {message}
          </AppText>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
        <Button
          testID="paywall-continue"
          label={t('common.continue')}
          loading={busy || offer.isLoading}
          disabled={!selected || !userId}
          onPress={() => void onContinue()}
        />
        <View style={styles.links}>
          <Pressable
            accessibilityRole="button"
            onPress={() => void onRestore()}
            style={styles.link}
          >
            <AppText variant="caption" color="textMuted">
              {t('paywall.restore')}
            </AppText>
          </Pressable>
          <AppText variant="caption" color="textMuted">
            ·
          </AppText>
          <Pressable
            accessibilityRole="link"
            onPress={() => openLink(TERMS_URL)}
            style={styles.link}
          >
            <AppText variant="caption" color="textMuted">
              {t('paywall.terms')}
            </AppText>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing.xl, paddingTop: spacing.xxl, gap: spacing.lg },
  thumbs: { flexDirection: 'row', gap: spacing.sm },
  thumb: { width: 72, height: 72, borderRadius: radius.card, backgroundColor: colors.surface2 },
  plusSlot: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.accent,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  options: { gap: spacing.md },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
  },
  optionActive: { borderColor: colors.accent },
  optionBody: { flex: 1, gap: 4 },
  optionTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  badge: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    gap: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  links: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  link: { minHeight: hitTarget, justifyContent: 'center', paddingHorizontal: spacing.xs },
});
