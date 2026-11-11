import { useTranslation } from 'react-i18next';

import type { Locale } from '@stampa/shared';

import { toSupportedLocale } from '.';

/** Current UI locale; re-renders when the language changes. */
export function useLocale(): Locale {
  const { i18n } = useTranslation();
  return toSupportedLocale(i18n.language);
}
