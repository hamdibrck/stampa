import type { ConfigContext, ExpoConfig } from 'expo/config';

// Bundle identifiers are placeholders until the store records exist (docs/TODO-MANUAL.md).
const BUNDLE_ID = process.env.STAMPA_BUNDLE_ID ?? 'app.stampa.mobile';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Stampa',
  slug: 'stampa',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'stampa',
  userInterfaceStyle: 'dark',
  backgroundColor: '#0E1726',
  ios: {
    bundleIdentifier: BUNDLE_ID,
    supportsTablet: false,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      CFBundleLocalizations: ['tr', 'en'],
    },
  },
  android: {
    package: BUNDLE_ID,
    adaptiveIcon: {
      backgroundColor: '#0E1726',
      foregroundImage: './assets/images/android-icon-foreground.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
  },
  plugins: [
    'expo-router',
    'expo-localization',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#0E1726',
        image: './assets/images/splash-icon.png',
        imageWidth: 96,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
});
