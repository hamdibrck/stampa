import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/components/ui';
import { colors, radius } from '@/theme/tokens';

type Props = {
  /** Plays the stamp animation (scale + haptic) whenever this flips to true. */
  animateKey?: number;
  size?: 'sm' | 'md';
};

/** Passport-style "GEZİLDİ" stamp: framed, slightly rotated (-8°). */
export function StampBadge({ animateKey = 0, size = 'md' }: Props) {
  const { t } = useTranslation();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      if (animateKey === 0) return;
    }
    scale.value = 2.4;
    opacity.value = 0;
    opacity.value = withTiming(1, { duration: 120 });
    scale.value = withSequence(
      withTiming(0.92, { duration: 160 }),
      withSpring(1, { damping: 9, stiffness: 220 }),
    );
    const timer = setTimeout(() => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    }, 150);
    return () => clearTimeout(timer);
  }, [animateKey, opacity, scale]);

  const animated = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ rotate: '-8deg' }, { scale: scale.value }],
  }));

  return (
    <Animated.View
      testID="stamp-badge"
      accessible
      accessibilityRole="text"
      accessibilityLabel={t('city.visited')}
      style={[styles.frame, size === 'sm' && styles.frameSm, animated]}
    >
      <AppText
        variant="overline"
        color="accent"
        maxFontSizeMultiplier={1.2}
        style={size === 'sm' ? styles.textSm : styles.text}
      >
        {t('city.visited')}
      </AppText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignSelf: 'flex-start',
    borderWidth: 2,
    borderColor: colors.accent,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  frameSm: { borderWidth: 1.5, paddingHorizontal: 6, paddingVertical: 2 },
  text: { fontSize: 13, lineHeight: 16, letterSpacing: 2 },
  textSm: { fontSize: 9, lineHeight: 12, letterSpacing: 1.2 },
});
