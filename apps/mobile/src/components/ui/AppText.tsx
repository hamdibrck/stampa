import { Text, type TextProps } from 'react-native';

import { colors, typography, type ColorToken, type TypographyVariant } from '@/theme/tokens';

export type AppTextProps = TextProps & {
  variant?: TypographyVariant;
  color?: ColorToken;
};

/** Themed text. Font scaling is capped so Dynamic Type cannot break layouts. */
export function AppText({ variant = 'body', color = 'text', style, ...rest }: AppTextProps) {
  return (
    <Text
      maxFontSizeMultiplier={1.4}
      {...rest}
      style={[typography[variant], { color: colors[color] }, style]}
    />
  );
}
