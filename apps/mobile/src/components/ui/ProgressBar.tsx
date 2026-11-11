import { StyleSheet, View } from 'react-native';

import { colors, radius } from '@/theme/tokens';

type Props = { value: number; height?: number; accessibilityLabel?: string };

/** value: 0..1 */
export function ProgressBar({ value, height = 6, accessibilityLabel }: Props) {
  const clamped = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={[styles.track, { height }]}
    >
      <View
        testID="progress-fill"
        style={[styles.fill, { width: `${clamped * 100}%`, minWidth: clamped > 0 ? height : 0 }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { backgroundColor: colors.track, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.accent, borderRadius: radius.pill },
});
