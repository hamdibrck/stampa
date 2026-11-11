import { supabase } from '@/lib/supabase';

import { clearLocalAccountData } from './auth';

/**
 * Permanently deletes the account: the `delete-account` Edge Function removes the photos from
 * storage and the auth user (which cascades to visits, photos, entitlements and the profile).
 */
export async function deleteAccount(): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
  if (error) return false;
  await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
  clearLocalAccountData();
  return true;
}
