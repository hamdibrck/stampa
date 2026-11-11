import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';

import { queryClient } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/store/session';
import { useVisits } from '@/store/visits';
import { syncNow } from '@/sync/engine';

export const AUTH_REDIRECT = 'stampa://auth/callback';

export class AuthError extends Error {
  constructor(public readonly code: 'not-configured' | 'cancelled' | 'failed') {
    super(code);
  }
}

function client() {
  if (!supabase) throw new AuthError('not-configured');
  return supabase;
}

/** Reads the stored session and keeps the session store in step with Supabase Auth. */
export function initAuth(): () => void {
  if (!supabase) {
    useSession.getState().setSession(null);
    return () => undefined;
  }
  void supabase.auth
    .getSession()
    .then(({ data }) => useSession.getState().setSession(data.session));
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    useSession.getState().setSession(session);
  });
  return () => data.subscription.unsubscribe();
}

export async function signInWithApple(): Promise<void> {
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') throw new AuthError('cancelled');
    throw new AuthError('failed');
  }
  if (!credential.identityToken) throw new AuthError('failed');
  const { error } = await client().auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
    nonce: rawNonce,
  });
  if (error) throw new AuthError('failed');
}

export async function signInWithGoogle(): Promise<void> {
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  if (!webClientId) throw new AuthError('not-configured');
  const auth = client().auth;
  // Loaded lazily: the native module is only needed when the button is used.
  const { GoogleSignin, isSuccessResponse } =
    await import('@react-native-google-signin/google-signin');
  GoogleSignin.configure({
    webClientId,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  });
  let idToken: string | null = null;
  try {
    await GoogleSignin.hasPlayServices();
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) throw new AuthError('cancelled');
    idToken = response.data.idToken;
  } catch (e) {
    if (e instanceof AuthError) throw e;
    throw new AuthError('failed');
  }
  if (!idToken) throw new AuthError('failed');
  const { error } = await auth.signInWithIdToken({ provider: 'google', token: idToken });
  if (error) throw new AuthError('failed');
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

export async function sendMagicLink(email: string): Promise<void> {
  const { error } = await client().auth.signInWithOtp({
    email: email.trim(),
    options: { emailRedirectTo: AUTH_REDIRECT, shouldCreateUser: true },
  });
  if (error) throw new AuthError('failed');
}

/** Extracts auth parameters from a magic-link redirect (query string or URL fragment). */
export function parseAuthCallback(url: string): {
  code?: string;
  accessToken?: string;
  refreshToken?: string;
  error?: string;
} {
  const params = new URLSearchParams();
  for (const part of [url.split('?')[1]?.split('#')[0], url.split('#')[1]]) {
    if (part) new URLSearchParams(part).forEach((v, k) => params.set(k, v));
  }
  return {
    code: params.get('code') ?? undefined,
    accessToken: params.get('access_token') ?? undefined,
    refreshToken: params.get('refresh_token') ?? undefined,
    error: params.get('error_description') ?? params.get('error') ?? undefined,
  };
}

export async function completeAuthCallback(url: string): Promise<void> {
  const { code, accessToken, refreshToken, error } = parseAuthCallback(url);
  if (error) throw new AuthError('failed');
  const auth = client().auth;
  if (code) {
    const res = await auth.exchangeCodeForSession(code);
    if (res.error) throw new AuthError('failed');
  } else if (accessToken && refreshToken) {
    const res = await auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (res.error) throw new AuthError('failed');
  } else {
    throw new AuthError('failed');
  }
}

/** Removes everything that belongs to the account from this device. */
export function clearLocalAccountData() {
  useVisits.getState().clear();
  queryClient.clear();
}

/**
 * Signs out. Pending changes are pushed first; the local copy is then removed so the next
 * person using this device does not inherit the previous account's stamps.
 */
export async function signOut(): Promise<void> {
  await syncNow();
  await supabase?.auth.signOut();
  clearLocalAccountData();
}
