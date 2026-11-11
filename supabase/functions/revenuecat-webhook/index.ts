// RevenueCat → Stampa. Verifies the shared secret and hands the event to Postgres, where
// public.apply_revenuecat_event applies it exactly once (see migration 20261111000400).
import { createClient } from 'npm:@supabase/supabase-js@2';

import { json } from '../_shared/http.ts';
import { isAuthorized, parseEvent } from '../_shared/webhook.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  if (!isAuthorized(req.headers.get('Authorization'), Deno.env.get('REVENUECAT_WEBHOOK_SECRET'))) {
    return json({ error: 'unauthorized' }, 401);
  }

  const event = parseEvent(await req.json().catch(() => null));
  if (!event) return json({ error: 'invalid event' }, 400);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const { data, error } = await admin.rpc('apply_revenuecat_event', { p_event: event });
  if (error) {
    // A non-2xx answer makes RevenueCat retry later.
    console.error('apply_revenuecat_event failed', error.message);
    return json({ error: 'could not apply event' }, 500);
  }
  return json({ status: data });
});
