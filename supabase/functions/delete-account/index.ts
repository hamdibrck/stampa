// Deletes the calling user's account and all of their data (App Store requirement 5.1.1(v)).
import { createClient } from 'npm:@supabase/supabase-js@2';

import { deleteAccount } from '../_shared/deleteAccount.ts';
import { corsHeaders, json } from '../_shared/http.ts';

const BUCKET = 'photos';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // The user is identified by their own JWT, never by a parameter.
  const token = req.headers.get('Authorization')?.replace(/^Bearer /, '') ?? '';
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth.user) return json({ error: 'unauthorized' }, 401);
  const userId = auth.user.id;

  try {
    const result = await deleteAccount(
      {
        list: async (prefix) => {
          const out = [];
          for (let offset = 0; ; offset += 1000) {
            const { data, error } = await admin.storage
              .from(BUCKET)
              .list(prefix, { limit: 1000, offset });
            if (error) throw error;
            out.push(...(data ?? []).map((e) => ({ name: e.name, isFolder: e.id === null })));
            if (!data || data.length < 1000) break;
          }
          return out;
        },
        remove: async (paths) => {
          const { error } = await admin.storage.from(BUCKET).remove(paths);
          if (error) throw error;
        },
        deleteUser: async (id) => {
          const { error } = await admin.auth.admin.deleteUser(id);
          if (error) throw error;
        },
      },
      userId,
    );

    // Best effort: also forget the customer at RevenueCat.
    const rcKey = Deno.env.get('REVENUECAT_SECRET_API_KEY');
    if (rcKey) {
      await fetch(`https://api.revenuecat.com/v1/subscribers/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${rcKey}` },
      }).catch(() => undefined);
    }
    return json({ deleted: true, ...result });
  } catch (e) {
    console.error('delete-account failed', e instanceof Error ? e.message : e);
    return json({ error: 'could not delete account' }, 500);
  }
});
