/** Design tokens from the approved mockups. Dark theme only, single accent colour. */
export const colors = {
  bg: '#0E1726',
  surface: '#172235',
  surface2: '#24324A',
  track: '#24324A',
  border: '#2C3B57',
  mapOcean: '#121C2D',
  mapLand: '#22304A',
  mapLandVisited: '#3B5079',
  mapBorder: '#2C3B57',
  text: '#EEF2F7',
  textMuted: '#9AA8BD',
  textSoft: '#C3CEDD',
  pinUnvisited: '#8FA0BA',
  accent: '#FF6B4A',
  /** Text/icon colour on top of the accent colour (contrast ≥ 4.5:1). */
  onAccent: '#0E1726',
  tabBar: '#0B1320',
  danger: '#FF6B6B',
  overlay: 'rgba(5, 10, 20, 0.6)',
} as const;

export const accentAlternatives = ['#3DD6B5', '#F5C542', '#7AA2FF'] as const;

export const radius = {
  sm: 8,
  chip: 12,
  card: 16,
  button: 16,
  sheet: 28,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
} as const;

/** Minimum touch target (pt). */
export const hitTarget = 44;

export const fonts = {
  displayMedium: 'SpaceGrotesk_500Medium',
  displayBold: 'SpaceGrotesk_700Bold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemiBold: 'Inter_600SemiBold',
} as const;

export const typography = {
  hero: { fontFamily: fonts.displayBold, fontSize: 44, lineHeight: 48 },
  title: { fontFamily: fonts.displayBold, fontSize: 24, lineHeight: 30 },
  heading: { fontFamily: fonts.displayMedium, fontSize: 18, lineHeight: 24 },
  number: { fontFamily: fonts.displayMedium, fontSize: 15, lineHeight: 20 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  bodyMedium: { fontFamily: fonts.bodyMedium, fontSize: 15, lineHeight: 22 },
  label: { fontFamily: fonts.bodySemiBold, fontSize: 15, lineHeight: 20 },
  caption: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  overline: { fontFamily: fonts.bodySemiBold, fontSize: 11, lineHeight: 14, letterSpacing: 1 },
} as const;

export type TypographyVariant = keyof typeof typography;
export type ColorToken = keyof typeof colors;
