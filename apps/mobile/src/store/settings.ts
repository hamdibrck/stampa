import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { Locale } from '@stampa/shared';

import i18n, { deviceLocale } from '@/i18n';
import { zustandStorage } from '@/lib/storage';

type SettingsState = {
  /** null = follow the device language. */
  localeOverride: Locale | null;
  setLocale: (locale: Locale) => void;
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      localeOverride: null,
      setLocale: (locale) => {
        void i18n.changeLanguage(locale);
        set({ localeOverride: locale });
      },
    }),
    {
      name: 'settings.v1',
      storage: createJSONStorage(() => zustandStorage),
      onRehydrateStorage: () => (state) => {
        void i18n.changeLanguage(state?.localeOverride ?? deviceLocale());
      },
    },
  ),
);
