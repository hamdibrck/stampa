import * as WebBrowser from 'expo-web-browser';

export const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL;
export const TERMS_URL = process.env.EXPO_PUBLIC_TERMS_URL;

export function openLink(url: string | undefined) {
  if (url) void WebBrowser.openBrowserAsync(url).catch(() => undefined);
}
