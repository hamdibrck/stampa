import type { ConfigContext, ExpoConfig } from 'expo/config';

// Bundle identifiers are placeholders until the store records exist (docs/TODO-MANUAL.md).
const BUNDLE_ID = process.env.STAMPA_BUNDLE_ID ?? 'app.stampa.mobile';

// Reversed iOS OAuth client id (com.googleusercontent.apps.<id>) for Google Sign-In.
const GOOGLE_IOS_URL_SCHEME =
  process.env.GOOGLE_IOS_URL_SCHEME ?? 'com.googleusercontent.apps.placeholder';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Stampa',
  slug: 'stampa',
  owner: 'hamdialper.biricik',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'stampa',
  userInterfaceStyle: 'dark',
  backgroundColor: '#0E1726',
  ios: {
    bundleIdentifier: BUNDLE_ID,
    supportsTablet: false,
    usesAppleSignIn: true,
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
    'expo-dev-client',
    '@maplibre/maplibre-react-native',
    'expo-apple-authentication',
    ['@react-native-google-signin/google-signin', { iosUrlScheme: GOOGLE_IOS_URL_SCHEME }],
    [
      'expo-image-picker',
      {
        photosPermission:
          'Stampa, gezdiğin şehirlere fotoğraf ekleyebilmen için fotoğraf arşivine erişir.',
        cameraPermission: false,
        microphonePermission: false,
      },
    ],
    [
      'expo-splash-screen',
      {
        backgroundColor: '#0E1726',
        image: './assets/images/splash-icon.png',
        imageWidth: 96,
      },
    ],
  ],
  extra: {
    eas: { projectId: 'a391f657-c694-463f-98f6-6fad9e2ccafa' },
  },
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
});
