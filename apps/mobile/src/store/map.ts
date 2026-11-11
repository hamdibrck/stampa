import { create } from 'zustand';

import { cityById, countryByIso } from '@/data/world';

export type CameraCommand =
  | { kind: 'center'; center: [number, number]; zoom: number; nonce: number }
  | { kind: 'bounds'; bounds: [number, number, number, number]; nonce: number };

type MapState = {
  selectedCityId: number | null;
  /** Latest camera request; the map consumes it when `nonce` changes. */
  command: CameraCommand | null;
  select: (cityId: number | null) => void;
  /** Selects a city and flies the map to it. */
  focusCity: (cityId: number, zoom?: number) => void;
  focusCountry: (iso2: string) => void;
};

let nonce = 0;

export const useMapStore = create<MapState>((set) => ({
  selectedCityId: null,
  command: null,
  select: (cityId) => set({ selectedCityId: cityId }),
  focusCity: (cityId, zoom = 6.5) => {
    const city = cityById.get(cityId);
    if (!city) return;
    set({
      selectedCityId: cityId,
      command: { kind: 'center', center: [city.lon, city.lat], zoom, nonce: ++nonce },
    });
  },
  focusCountry: (iso2) => {
    const country = countryByIso.get(iso2);
    if (!country) return;
    const [w, s, e, n] = country.bbox;
    const pad = Math.max(1.5, (e - w) * 0.15, (n - s) * 0.15);
    set({
      selectedCityId: null,
      command: {
        kind: 'bounds',
        bounds: [
          Math.max(-180, w - pad),
          Math.max(-85, s - pad),
          Math.min(180, e + pad),
          Math.min(85, n + pad),
        ],
        nonce: ++nonce,
      },
    });
  },
}));
