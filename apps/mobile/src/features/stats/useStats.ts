import { useQuery } from '@tanstack/react-query';

import { storage } from '@/lib/storage';
import { supabase } from '@/lib/supabase';

export type CityInfo = {
  summaryTr: string | null;
  summaryEn: string | null;
  /**
   * Share of active users who visited the city (0..1), or null when fewer than 20 users have
   * (k-anonymity is enforced by the database view) or stats are unavailable.
   */
  share: number | null;
};

const summaryKey = (cityId: number) => `city-summary.v1:${cityId}`;

function cachedSummary(cityId: number): CityInfo | undefined {
  const raw = storage.getString(summaryKey(cityId));
  if (!raw) return undefined;
  try {
    const s = JSON.parse(raw) as { tr: string | null; en: string | null };
    return { summaryTr: s.tr, summaryEn: s.en, share: null };
  } catch {
    return undefined;
  }
}

/** Lazy-loaded summary + community share for one city. Summaries are kept on device afterwards. */
export function useCityInfo(cityId: number) {
  return useQuery({
    queryKey: ['city-info', cityId],
    enabled: supabase !== null,
    placeholderData: () => cachedSummary(cityId),
    queryFn: async (): Promise<CityInfo> => {
      const [city, stat] = await Promise.all([
        supabase!.from('cities').select('summary_tr, summary_en').eq('id', cityId).maybeSingle(),
        supabase!
          .from('city_stats_public')
          .select('visitor_share')
          .eq('city_id', cityId)
          .maybeSingle(),
      ]);
      if (city.error) throw city.error;
      const info: CityInfo = {
        summaryTr: (city.data?.summary_tr as string | null) ?? null,
        summaryEn: (city.data?.summary_en as string | null) ?? null,
        share: (stat.data?.visitor_share as number | null) ?? null,
      };
      storage.set(summaryKey(cityId), JSON.stringify({ tr: info.summaryTr, en: info.summaryEn }));
      return info;
    },
  });
}

export type CountryStats = {
  /** Average number of cities visited by users who have been to the country, or null. */
  averageCities: number | null;
  /** cityId → share (0..1); cities below the k-anonymity threshold are absent. */
  shares: Record<number, number>;
};

export function useCountryStats(iso2: string) {
  return useQuery({
    queryKey: ['country-stats', iso2],
    enabled: supabase !== null,
    queryFn: async (): Promise<CountryStats> => {
      const [country, cities] = await Promise.all([
        supabase!
          .from('country_stats_public')
          .select('avg_visited_cities')
          .eq('country_iso2', iso2)
          .maybeSingle(),
        supabase!
          .from('city_stats_public')
          .select('city_id, visitor_share')
          .eq('country_iso2', iso2)
          .not('visitor_share', 'is', null),
      ]);
      if (cities.error) throw cities.error;
      const shares: Record<number, number> = {};
      for (const row of cities.data ?? []) {
        shares[row.city_id as number] = row.visitor_share as number;
      }
      return {
        averageCities: (country.data?.avg_visited_cities as number | null) ?? null,
        shares,
      };
    },
  });
}
