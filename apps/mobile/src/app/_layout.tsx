import '@/i18n';

import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { SpaceGrotesk_500Medium } from '@expo-google-fonts/space-grotesk/500Medium';
import { SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk/700Bold';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { DarkTheme, Stack, ThemeProvider, type NativeStackNavigationOptions } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { initAuth } from '@/features/auth/auth';
import { identifyPurchaser } from '@/features/purchases/purchases';
import { queryClient } from '@/lib/queryClient';
import { useUserId } from '@/store/session';
import '@/store/settings';
import { startSync } from '@/sync/engine';
import { colors } from '@/theme/tokens';

void SplashScreen.preventAutoHideAsync();

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.bg,
    text: colors.text,
    border: colors.border,
    primary: colors.accent,
  },
};

/** Native bottom sheet: 28pt corners, grabber, medium + full detents. */
const sheetOptions: NativeStackNavigationOptions = {
  presentation: 'formSheet',
  sheetAllowedDetents: [0.64, 1],
  sheetCornerRadius: 28,
  sheetGrabberVisible: true,
  contentStyle: { backgroundColor: colors.surface },
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });
  const ready = fontsLoaded || !!fontError;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  const userId = useUserId();

  useEffect(() => {
    const stopAuth = initAuth();
    const stopSync = startSync();
    return () => {
      stopAuth();
      stopSync();
    };
  }, []);

  useEffect(() => {
    void identifyPurchaser(userId);
  }, [userId]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider value={navigationTheme}>
            <StatusBar style="light" />
            <Stack
              screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}
            >
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="country/[iso2]" />
              <Stack.Screen name="about" />
              <Stack.Screen name="auth/callback" />
              <Stack.Screen name="city/[id]" options={sheetOptions} />
              <Stack.Screen name="paywall" options={sheetOptions} />
              <Stack.Screen name="sign-in" options={{ presentation: 'modal' }} />
            </Stack>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
