// Reconciles the caller's Plus subscription with RevenueCat. Used after a purchase or a restore,
// so access does not depend on webhook timing.
import { createClient } from 'npm:@supabase/supabase-js@2';

import { activePlus } from '../_shared/entitlements.ts';
import { corsHeaders, json } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const token = req.headers.get('Authorization')?.replace(/^Bearer /, '') ?? '';
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth.user) return json({ error: 'unauthorized' }, 401);
  const userId = auth.user.id;

  const rcKey = Deno.env.get('REVENUECAT_SECRET_API_KEY');
  if (!rcKey) return json({ plus: false, reason: 'not configured' });

  const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${userId}`, {
    headers: { Authorization: `Bearer ${rcKey}` },
  });
  if (!res.ok) return json({ error: 'revenuecat unavailable' }, 502);

  const plus = activePlus(await res.json(), userId, new Date());
  if (!plus) return json({ plus: false });

  const { error } = await admin.from('entitlements').upsert(
    {
      user_id: userId,
      kind: 'plus',
      expires_at: plus.expiresAt,
      product_id: plus.productId,
      source_event_id: plus.sourceEventId,
    },
    { onConflict: 'source_event_id', ignoreDuplicates: true },
  );
  if (error) return json({ error: 'could not store entitlement' }, 500);
  return json({ plus: true, expires_at: plus.expiresAt });
});
