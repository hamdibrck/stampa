import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import type { Locale } from '@stampa/shared';

import en from './locales/en.json';
import tr from './locales/tr.json';

export const supportedLocales: Locale[] = ['tr', 'en'];

export function toSupportedLocale(code: string | null | undefined): Locale {
  return code?.toLowerCase().startsWith('tr') ? 'tr' : 'en';
}

export function deviceLocale(): Locale {
  try {
    return toSupportedLocale(getLocales()[0]?.languageCode);
  } catch {
    return 'en';
  }
}

void i18n.use(initReactI18next).init({
  resources: { tr: { translation: tr }, en: { translation: en } },
  lng: deviceLocale(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export function currentLocale(): Locale {
  return toSupportedLocale(i18n.language);
}

/** Manual plural selection: Hermes does not ship Intl.PluralRules on every platform. */
export function countLabel(unit: 'city' | 'country', count: number): string {
  return i18n.t(`units.${unit}${count === 1 ? 'One' : 'Other'}`, { count });
}

export default i18n;
