import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, type ViewStyle } from 'react-native';

import { colors, hitTarget, radius, type ColorToken } from '@/theme/tokens';

type Props = {
  icon: ComponentProps<typeof Ionicons>['name'];
  /** Required: icon-only buttons must be labelled for screen readers. */
  accessibilityLabel: string;
  onPress: () => void;
  color?: ColorToken;
  size?: number;
  filled?: boolean;
  style?: ViewStyle;
  testID?: string;
};

export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  color = 'text',
  size = 22,
  filled = true,
  style,
  testID,
}: Props) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.base,
        filled && styles.filled,
        pressed && styles.pressed,
        style,
      ]}
    >
      <Ionicons name={icon} size={size} color={colors[color]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: hitTarget,
    height: hitTarget,
    borderRadius: radius.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filled: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  pressed: { opacity: 0.7 },
});
