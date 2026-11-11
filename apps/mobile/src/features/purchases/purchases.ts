import { Platform } from 'react-native';
import Purchases, { type PurchasesPackage } from 'react-native-purchases';

import { fetchQuota, invalidatePhotos, type Quota } from '@/features/photos/photos';
import { supabase } from '@/lib/supabase';

/** Store product identifiers. Prices are never hard-coded: they come from RevenueCat offerings. */
export const PRODUCT_CITY_PACK = 'city_pack_10';
export const PRODUCT_PLUS = 'plus_yearly';

const apiKey = Platform.select({
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
});

export const isPurchasesConfigured = !!apiKey;

let configuredFor: string | null = null;

/** RevenueCat app_user_id is the Supabase user id, so webhooks can be matched to accounts. */
export async function identifyPurchaser(userId: string | null): Promise<void> {
  if (!apiKey || configuredFor === userId) return;
  try {
    if (userId === null) {
      if (configuredFor !== null) await Purchases.logOut();
    } else if (configuredFor === null && !(await Purchases.isConfigured())) {
      Purchases.configure({ apiKey, appUserID: userId });
    } else {
      await Purchases.logIn(userId);
    }
    configuredFor = userId;
  } catch {
    // Purchases stay unavailable; the paywall shows that state.
  }
}

export type Offer = { cityPack: PurchasesPackage | null; plus: PurchasesPackage | null };

export function findOffer(packages: PurchasesPackage[]): Offer {
  const byProduct = (id: string) =>
    packages.find(
      (p) => p.product.identifier === id || p.product.identifier.startsWith(`${id}:`),
    ) ?? null;
  return { cityPack: byProduct(PRODUCT_CITY_PACK), plus: byProduct(PRODUCT_PLUS) };
}

export async function loadOffer(): Promise<Offer> {
  if (!apiKey || configuredFor === null) return { cityPack: null, plus: null };
  const offerings = await Purchases.getOfferings();
  return findOffer(offerings.current?.availablePackages ?? []);
}

export type PurchaseResult = 'purchased' | 'pending' | 'cancelled' | 'failed';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Asks the backend to reconcile entitlements with RevenueCat (covers slow or missed webhooks). */
async function refreshEntitlements(): Promise<void> {
  await supabase?.functions.invoke('refresh-entitlements').catch(() => undefined);
}

/** Waits for the purchase to reach the quota on the server (the webhook can lag a few seconds). */
async function waitForQuota(cityId: number, before: Quota | null): Promise<boolean> {
  const changed = (q: Quota) => !before || q.hasPlus !== before.hasPlus || q.quota !== before.quota;
  for (let attempt = 0; attempt < 8; attempt++) {
    await sleep(attempt === 0 ? 800 : 2000);
    if (attempt === 2) await refreshEntitlements();
    const now = await fetchQuota(cityId).catch(() => null);
    if (now && changed(now)) return true;
  }
  return false;
}

async function buy(
  userId: string,
  cityId: number,
  pkg: PurchasesPackage,
  prepare?: () => Promise<boolean>,
): Promise<PurchaseResult> {
  const before = await fetchQuota(cityId).catch(() => null);
  if (prepare && !(await prepare())) return 'failed';
  try {
    await Purchases.purchasePackage(pkg);
  } catch (e) {
    return (e as { userCancelled?: boolean }).userCancelled ? 'cancelled' : 'failed';
  }
  const applied = await waitForQuota(cityId, before);
  await invalidatePhotos(userId, cityId);
  return applied ? 'purchased' : 'pending';
}

/** +10 photos for one city. The city is recorded first so the webhook knows where it belongs. */
export function purchaseCityPack(userId: string, cityId: number, pkg: PurchasesPackage) {
  return buy(userId, cityId, pkg, async () => {
    const { error } = await supabase!
      .from('purchase_intents')
      .insert({ city_id: cityId, product_id: PRODUCT_CITY_PACK });
    return !error;
  });
}

export function purchasePlus(userId: string, cityId: number, pkg: PurchasesPackage) {
  return buy(userId, cityId, pkg);
}

/**
 * Restores purchases. Plus comes back through the store/RevenueCat; city packs are stored with
 * the account on the server and only need a refresh.
 */
export async function restorePurchases(userId: string, cityId?: number): Promise<boolean> {
  if (!apiKey || configuredFor === null) return false;
  try {
    await Purchases.restorePurchases();
    await refreshEntitlements();
    if (cityId !== undefined) await invalidatePhotos(userId, cityId);
    return true;
  } catch {
    return false;
  }
}
