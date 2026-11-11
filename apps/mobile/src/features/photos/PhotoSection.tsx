import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import type { City } from '@/data/world';
import { useUserId } from '@/store/session';
import { colors, radius, spacing } from '@/theme/tokens';

import { deletePhoto, pickAndUploadPhoto, usePhotos, useQuota, type Photo } from './photos';
import { canAddPhoto } from './resize';

export const FREE_PHOTOS = 2;
const COLUMNS = 3;

type Props = { city: City };

type Tile =
  | { kind: 'photo'; photo: Photo }
  | { kind: 'add' }
  | { kind: 'more' }
  | { kind: 'spacer'; key: string };

/**
 * Photo grid for a city: `0/2 ücretsiz`, free slots and a locked "Daha fazla" tile that opens
 * the paywall. The numbers shown here are informational; the server enforces the quota.
 */
export function PhotoSection({ city }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const userId = useUserId();
  const photos = usePhotos(userId, city.id);
  const quotaQuery = useQuota(userId, city.id);
  const [uploading, setUploading] = useState(false);

  const list = photos.data ?? [];
  const used = Math.max(list.length, quotaQuery.data?.used ?? 0);
  const quota = quotaQuery.data ? quotaQuery.data.quota : FREE_PHOTOS;
  const openPaywall = () =>
    router.push({ pathname: '/paywall', params: { city: String(city.id) } });

  const onAdd = async () => {
    if (!userId) {
      router.push('/sign-in');
      return;
    }
    if (!canAddPhoto(used, quota)) {
      openPaywall();
      return;
    }
    setUploading(true);
    const result = await pickAndUploadPhoto(userId, city.id);
    setUploading(false);
    if (result === 'quota-exceeded') openPaywall();
    else if (result === 'permission-denied') Alert.alert(t('city.photoPermission'));
    else if (result === 'failed') Alert.alert(t('city.uploadFailed'));
  };

  const onDelete = (photo: Photo) => {
    if (!userId) return;
    Alert.alert(t('city.deletePhotoConfirm'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('city.deletePhoto'),
        style: 'destructive',
        onPress: () => void deletePhoto(userId, city.id, photo.path),
      },
    ]);
  };

  const tiles: Tile[] = list.map((photo) => ({ kind: 'photo', photo }));
  if (quota === null) {
    tiles.push({ kind: 'add' });
  } else {
    for (let i = used; i < quota; i++) tiles.push({ kind: 'add' });
    tiles.push({ kind: 'more' });
  }
  while (tiles.length % COLUMNS !== 0) tiles.push({ kind: 'spacer', key: `s${tiles.length}` });

  const label =
    quota === null
      ? t('city.photosUnlimited', { used })
      : quota === FREE_PHOTOS
        ? t('city.photosFree', { used: Math.min(used, quota), total: quota })
        : t('city.photosCount', { used, total: quota });

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <AppText variant="heading">{t('city.photos')}</AppText>
        <AppText variant="caption" color="textMuted" testID="photo-quota-label">
          {label}
        </AppText>
      </View>
      {!userId ? (
        <AppText variant="caption" color="textMuted">
          {t('city.signInForPhotos')}
        </AppText>
      ) : null}
      {photos.isLoading ? (
        <ActivityIndicator color={colors.accent} accessibilityLabel={t('common.loading')} />
      ) : null}
      {photos.isError ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.retry')}
          onPress={() => void photos.refetch()}
          style={styles.error}
        >
          <AppText variant="caption" color="textMuted">
            {t('common.error')} {t('common.retry')}
          </AppText>
        </Pressable>
      ) : null}
      <View style={styles.grid}>
        {tiles.map((tile, index) => {
          if (tile.kind === 'spacer') return <View key={tile.key} style={styles.cell} />;
          if (tile.kind === 'photo') {
            return (
              <Pressable
                key={tile.photo.id}
                accessibilityRole="imagebutton"
                accessibilityLabel={`${t('city.photos')} ${index + 1}`}
                accessibilityHint={t('city.deletePhoto')}
                onLongPress={() => onDelete(tile.photo)}
                style={[styles.cell, styles.photo]}
              >
                <Image
                  source={{ uri: tile.photo.url, cacheKey: tile.photo.path }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  transition={150}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('city.deletePhoto')}
                  hitSlop={10}
                  onPress={() => onDelete(tile.photo)}
                  style={styles.remove}
                >
                  <Ionicons name="close" size={14} color={colors.text} />
                </Pressable>
              </Pressable>
            );
          }
          if (tile.kind === 'add') {
            return (
              <Pressable
                key={`add${index}`}
                testID="photo-add"
                accessibilityRole="button"
                accessibilityLabel={t('city.addPhoto')}
                disabled={uploading}
                onPress={() => void onAdd()}
                style={({ pressed }) => [styles.cell, styles.slot, pressed && styles.pressed]}
              >
                {uploading && index === list.length ? (
                  <ActivityIndicator color={colors.accent} />
                ) : (
                  <Ionicons name="add" size={26} color={colors.textMuted} />
                )}
              </Pressable>
            );
          }
          return (
            <Pressable
              key="more"
              testID="photo-more"
              accessibilityRole="button"
              accessibilityLabel={t('city.morePhotos')}
              onPress={() => (userId ? openPaywall() : router.push('/sign-in'))}
              style={({ pressed }) => [
                styles.cell,
                styles.slot,
                styles.locked,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name="lock-closed" size={18} color={colors.textMuted} />
              <AppText variant="caption" color="textMuted" numberOfLines={1}>
                {t('city.morePhotos')}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cell: { flexBasis: '30%', flexGrow: 1, aspectRatio: 1, borderRadius: radius.card },
  photo: { overflow: 'hidden', backgroundColor: colors.surface2 },
  remove: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slot: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  locked: { borderStyle: 'solid', backgroundColor: colors.surface2 },
  pressed: { opacity: 0.7 },
  error: { minHeight: 44, justifyContent: 'center' },
});
