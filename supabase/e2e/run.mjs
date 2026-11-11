// End-to-end check against a running local stack, through the real HTTP APIs
// (Auth, PostgREST, Storage, Edge Functions) — the same paths the app uses.
//
//   npx supabase start
//   npx supabase functions serve --env-file supabase/e2e/functions.env   (separate terminal)
//   pnpm test:e2e
import { createClient } from '@supabase/supabase-js';
import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const status = JSON.parse(
  execFileSync('npx', ['supabase', 'status', '-o', 'json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }),
);
const URL = status.API_URL;
const WEBHOOK_SECRET = process.env.REVENUECAT_WEBHOOK_SECRET ?? 'local-webhook-secret';
const ISTANBUL = 745044;
const ANKARA = 323786;

const admin = createClient(URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const user = createClient(URL, status.ANON_KEY, { auth: { persistSession: false } });

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? '✓' : '✗'} ${name}${ok || !detail ? '' : ` — ${detail}`}`);
  if (!ok) failures++;
}

// A tiny valid JPEG is enough: the server checks type, size, path and quota.
const jpeg = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
  'base64',
);
const upload = (client, uid, city) =>
  client.storage
    .from('photos')
    .upload(`${uid}/${city}/${randomUUID()}.jpg`, jpeg, { contentType: 'image/jpeg' });
const webhook = (event, secret = WEBHOOK_SECRET) =>
  fetch(`${URL}/functions/v1/revenuecat-webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
    body: JSON.stringify({ event }),
  });

const email = `e2e-${Date.now()}@example.test`;
const { data: signUp, error: signUpError } = await user.auth.signUp({
  email,
  password: randomUUID(),
});
if (signUpError || !signUp.user) throw new Error(`sign-up failed: ${signUpError?.message}`);
const uid = signUp.user.id;

// ── Visits: offline queue → sync ──────────────────────────────────────────────
const sync = await user.rpc('sync_visits', {
  ops: [
    { city_id: ISTANBUL, op: 'upsert', visited_at: '2026-11-11', at: new Date().toISOString() },
    { city_id: ANKARA, op: 'upsert', visited_at: '2026-11-10', at: new Date().toISOString() },
  ],
});
check('queued stamps sync to the account', sync.data?.length === 2, sync.error?.message);

// ── Photos: 2 free, 3rd rejected by the server ────────────────────────────────
const u1 = await upload(user, uid, ISTANBUL);
const u2 = await upload(user, uid, ISTANBUL);
const u3 = await upload(user, uid, ISTANBUL);
check(
  '1st and 2nd photo upload succeed',
  !u1.error && !u2.error,
  u1.error?.message ?? u2.error?.message,
);
check(
  '3rd photo upload is rejected by the Storage API',
  !!u3.error,
  'upload unexpectedly succeeded',
);
const rows = await user.from('photos').select('storage_path').eq('city_id', ISTANBUL);
check('photo rows mirror the uploaded files', rows.data?.length === 2);
const signed = await user.storage
  .from('photos')
  .createSignedUrl(rows.data?.[0]?.storage_path ?? '', 60);
const fetched = signed.data ? await fetch(signed.data.signedUrl) : null;
check('photos are served through signed URLs', fetched?.status === 200);
const publicFetch = await fetch(
  `${URL}/storage/v1/object/public/photos/${rows.data?.[0]?.storage_path}`,
);
check('photos are not publicly readable', publicFetch.status >= 400);

// ── Purchases: webhook → entitlement → quota ──────────────────────────────────
const badAuth = await webhook({ id: randomUUID(), type: 'TEST' }, 'wrong-secret');
check('webhook rejects a wrong secret', badAuth.status === 401, `status ${badAuth.status}`);

await user.from('purchase_intents').insert({ city_id: ISTANBUL });
const packEvent = {
  id: randomUUID(),
  type: 'NON_RENEWING_PURCHASE',
  product_id: 'city_pack_10',
  app_user_id: uid,
  transaction_id: randomUUID(),
};
const pack = await webhook(packEvent);
check('city pack webhook is applied', (await pack.json()).status === 'applied');
const retry = await webhook(packEvent);
check('a retried webhook is a no-op', (await retry.json()).status === 'duplicate');
const quota = await user.rpc('my_photo_quota', { p_city: ISTANBUL }).single();
check('city pack raises the quota to 12', quota.data?.quota === 12, JSON.stringify(quota.data));
check('3rd photo is accepted after the purchase', !(await upload(user, uid, ISTANBUL)).error);
const other = await user.rpc('my_photo_quota', { p_city: ANKARA }).single();
check('other cities keep the free quota', other.data?.quota === 2);

const plus = await webhook({
  id: randomUUID(),
  type: 'INITIAL_PURCHASE',
  product_id: 'plus_yearly',
  app_user_id: uid,
  original_transaction_id: randomUUID(),
  expiration_at_ms: Date.now() + 365 * 86400 * 1000,
});
check('Plus webhook is applied', (await plus.json()).status === 'applied');
const plusQuota = await user.rpc('my_photo_quota', { p_city: ANKARA }).single();
check(
  'Plus removes the limit everywhere',
  plusQuota.data?.quota === null && plusQuota.data?.has_plus === true,
);
await upload(user, uid, ANKARA);
await upload(user, uid, ANKARA);
check('Plus accepts a 3rd photo in another city', !(await upload(user, uid, ANKARA)).error);

// ── Account deletion ──────────────────────────────────────────────────────────
const before = await admin.storage.from('photos').list(`${uid}/${ISTANBUL}`);
check('files exist before deletion', (before.data?.length ?? 0) === 3);
const del = await user.functions.invoke('delete-account', { method: 'POST' });
check('delete-account succeeds', !del.error && del.data?.deleted === true, del.error?.message);
const left = await Promise.all(
  ['visits', 'photos', 'entitlements', 'profiles', 'purchase_intents'].map((t) =>
    admin.from(t).select('*', { count: 'exact', head: true }).eq('user_id', uid),
  ),
);
check(
  'all database rows of the user are gone',
  left.every((r) => r.count === 0),
  left.map((r) => r.count).join(','),
);
const filesA = await admin.storage.from('photos').list(`${uid}/${ISTANBUL}`);
const filesB = await admin.storage.from('photos').list(`${uid}/${ANKARA}`);
check('all photo files are gone', (filesA.data?.length ?? 0) + (filesB.data?.length ?? 0) === 0);
const gone = await admin.auth.admin.getUserById(uid);
check('the auth user is gone', !gone.data?.user);

console.log(failures === 0 ? '\nAll end-to-end checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
