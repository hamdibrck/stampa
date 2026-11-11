import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { colors } from '@/theme/tokens';

type Props = {
  /** 0..1 */
  value: number;
  size?: number;
  strokeWidth?: number;
  children?: ReactNode;
  accessibilityLabel?: string;
};

export function RingChart({
  value,
  size = 132,
  strokeWidth = 12,
  children,
  accessibilityLabel,
}: Props) {
  const clamped = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.track}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {clamped > 0 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={colors.accent}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${circumference * clamped} ${circumference}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null}
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
