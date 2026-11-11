import { createMMKV } from 'react-native-mmkv';
import type { StateStorage } from 'zustand/middleware';

/** Single on-device key-value store (MMKV). Synchronous, so state is ready before first render. */
export const storage = createMMKV({ id: 'stampa' });

export const zustandStorage: StateStorage = {
  getItem: (name) => storage.getString(name) ?? null,
  setItem: (name, value) => storage.set(name, value),
  removeItem: (name) => {
    storage.remove(name);
  },
};

/** Storage adapter for the Supabase auth session. */
export const authStorage = {
  getItem: (key: string) => storage.getString(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => {
    storage.remove(key);
  },
};
