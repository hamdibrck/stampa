import { useQuery } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { queryClient } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';

import { JPEG_QUALITY, photoPath, targetSize } from './resize';

const BUCKET = 'photos';
const SIGNED_URL_TTL = 60 * 60;

export type Photo = {
  id: string;
  path: string;
  url: string;
  width: number | null;
  height: number | null;
};
export type Quota = { used: number; quota: number | null; hasPlus: boolean };

export const photosKey = (userId: string | null, cityId: number) => ['photos', userId, cityId];
export const quotaKey = (userId: string | null, cityId: number) => ['photo-quota', userId, cityId];

export function usePhotos(userId: string | null, cityId: number) {
  return useQuery({
    queryKey: photosKey(userId, cityId),
    enabled: supabase !== null && userId !== null,
    staleTime: (SIGNED_URL_TTL / 2) * 1000,
    queryFn: async (): Promise<Photo[]> => {
      const { data, error } = await supabase!
        .from('photos')
        .select('id, storage_path, width, height')
        .eq('city_id', cityId)
        .order('created_at');
      if (error) throw error;
      if (!data?.length) return [];
      const signed = await supabase!.storage.from(BUCKET).createSignedUrls(
        data.map((p) => p.storage_path as string),
        SIGNED_URL_TTL,
      );
      if (signed.error) throw signed.error;
      return data.flatMap((p, i) => {
        const url = signed.data[i]?.signedUrl;
        return url
          ? [
              {
                id: p.id as string,
                path: p.storage_path as string,
                url,
                width: p.width,
                height: p.height,
              },
            ]
          : [];
      });
    },
  });
}

/** Informational only: the server enforces the quota on upload. */
export function useQuota(userId: string | null, cityId: number) {
  return useQuery({
    queryKey: quotaKey(userId, cityId),
    enabled: supabase !== null && userId !== null,
    staleTime: 60 * 1000,
    queryFn: () => fetchQuota(cityId),
  });
}

export async function fetchQuota(cityId: number): Promise<Quota> {
  const { data, error } = await supabase!.rpc('my_photo_quota', { p_city: cityId }).single();
  if (error) throw error;
  const row = data as { used: number; quota: number | null; has_plus: boolean };
  return { used: row.used, quota: row.quota, hasPlus: row.has_plus };
}

export function invalidatePhotos(userId: string | null, cityId: number) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: photosKey(userId, cityId) }),
    queryClient.invalidateQueries({ queryKey: quotaKey(userId, cityId) }),
  ]);
}

export type UploadResult =
  'uploaded' | 'cancelled' | 'permission-denied' | 'quota-exceeded' | 'failed';

/** Picks an image, compresses it on device (long edge ≤ 2048px, JPEG 0.8) and uploads it. */
export async function pickAndUploadPhoto(userId: string, cityId: number): Promise<UploadResult> {
  if (!supabase) return 'failed';
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return 'permission-denied';

  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: false,
    quality: 1,
    exif: false,
  });
  const asset = picked.assets?.[0];
  if (picked.canceled || !asset) return 'cancelled';

  try {
    const size = targetSize(asset.width, asset.height);
    const image = await manipulateAsync(
      asset.uri,
      size.width !== asset.width ? [{ resize: size }] : [],
      { compress: JPEG_QUALITY, format: SaveFormat.JPEG },
    );
    const body = await (await fetch(image.uri)).arrayBuffer();
    const path = photoPath(userId, cityId, Crypto.randomUUID());
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, body, { contentType: 'image/jpeg', upsert: false });
    if (error) {
      // The storage policy rejects uploads beyond the quota (row-level security).
      const status = Number((error as { statusCode?: string | number }).statusCode);
      const denied = status === 403 || /row-level security|unauthorized/i.test(error.message);
      return denied ? 'quota-exceeded' : 'failed';
    }
    await supabase
      .from('photos')
      .update({ width: image.width, height: image.height })
      .eq('storage_path', path);
    await invalidatePhotos(userId, cityId);
    return 'uploaded';
  } catch {
    return 'failed';
  }
}

export async function deletePhoto(userId: string, cityId: number, path: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  await invalidatePhotos(userId, cityId);
  return !error;
}
