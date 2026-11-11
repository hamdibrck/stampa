begin;
select plan(22);

insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000c1', 'c@example.test');

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
end $$;
create function pg_temp.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;
create function pg_temp.quota(city integer) returns integer language sql as $$
  select public.photo_quota('00000000-0000-4000-8000-0000000000c1', city) $$;

-- Only the webhook (service role) may apply store events
select pg_temp.login('00000000-0000-4000-8000-0000000000c1');
select throws_ok($$ select public.apply_revenuecat_event('{"id": "x", "type": "INITIAL_PURCHASE"}') $$,
  '42501', null, 'clients cannot call apply_revenuecat_event');

-- ── City pack ───────────────────────────────────────────────────────────────
select lives_ok($$ insert into public.purchase_intents (city_id) values (745044) $$, 'client records a purchase intent');
select pg_temp.logout();

select is(public.apply_revenuecat_event('{
  "id": "evt-1", "type": "NON_RENEWING_PURCHASE", "product_id": "city_pack_10",
  "app_user_id": "00000000-0000-4000-8000-0000000000c1", "transaction_id": "txn-1"}'),
  'applied', 'city pack purchase is applied');
select is(pg_temp.quota(745044), 12, 'quota for the chosen city is 2 + 10');
select is(pg_temp.quota(323786), 2, 'other cities are unchanged');
select isnt((select consumed_at from public.purchase_intents limit 1), null, 'the intent is consumed');

select is(public.apply_revenuecat_event('{
  "id": "evt-1", "type": "NON_RENEWING_PURCHASE", "product_id": "city_pack_10",
  "app_user_id": "00000000-0000-4000-8000-0000000000c1", "transaction_id": "txn-1"}'),
  'duplicate', 'a retried webhook is recognised');
select is(pg_temp.quota(745044), 12, 'a retried webhook does not grant twice');

-- A second pack for the same city stacks
select pg_temp.login('00000000-0000-4000-8000-0000000000c1');
insert into public.purchase_intents (city_id) values (745044);
select pg_temp.logout();
select public.apply_revenuecat_event('{
  "id": "evt-2", "type": "NON_RENEWING_PURCHASE", "product_id": "city_pack_10",
  "app_user_id": "00000000-0000-4000-8000-0000000000c1", "transaction_id": "txn-2"}');
select is(pg_temp.quota(745044), 22, 'a second pack for the same city adds another 10');

-- Purchase without an intent is parked, then claimed by the buyer
select is(public.apply_revenuecat_event('{
  "id": "evt-3", "type": "NON_RENEWING_PURCHASE", "product_id": "city_pack_10",
  "app_user_id": "00000000-0000-4000-8000-0000000000c1", "transaction_id": "txn-3"}'),
  'unmatched', 'a pack without an intent is parked as unmatched');
select pg_temp.login('00000000-0000-4000-8000-0000000000c1');
select ok(public.claim_city_pack(323786), 'the buyer can assign the parked pack to a city');
select ok(not public.claim_city_pack(323786), 'a pack can be claimed only once');
select pg_temp.logout();
select is(pg_temp.quota(323786), 12, 'the claimed pack raises that city''s quota');

-- Refund takes the pack back
select public.apply_revenuecat_event('{
  "id": "evt-4", "type": "CANCELLATION", "cancel_reason": "CUSTOMER_SUPPORT", "product_id": "city_pack_10",
  "app_user_id": "00000000-0000-4000-8000-0000000000c1", "transaction_id": "txn-2"}');
select is(pg_temp.quota(745044), 12, 'a refunded pack is revoked');

-- ── Plus ────────────────────────────────────────────────────────────────────
select is(public.apply_revenuecat_event(jsonb_build_object(
  'id', 'evt-5', 'type', 'INITIAL_PURCHASE', 'product_id', 'plus_yearly',
  'app_user_id', '00000000-0000-4000-8000-0000000000c1', 'original_transaction_id', 'sub-1',
  'expiration_at_ms', (extract(epoch from now() + interval '1 year') * 1000)::bigint)),
  'applied', 'Plus purchase is applied');
select is(pg_temp.quota(745044), null, 'Plus gives unlimited photos');

select public.apply_revenuecat_event(jsonb_build_object(
  'id', 'evt-6', 'type', 'CANCELLATION', 'cancel_reason', 'UNSUBSCRIBE', 'product_id', 'plus_yearly',
  'app_user_id', '00000000-0000-4000-8000-0000000000c1', 'original_transaction_id', 'sub-1',
  'expiration_at_ms', (extract(epoch from now() + interval '1 year') * 1000)::bigint));
select is(pg_temp.quota(745044), null, 'turning off auto-renew keeps Plus until it expires');

select public.apply_revenuecat_event(jsonb_build_object(
  'id', 'evt-7', 'type', 'EXPIRATION', 'product_id', 'plus_yearly',
  'app_user_id', '00000000-0000-4000-8000-0000000000c1', 'original_transaction_id', 'sub-1',
  'expiration_at_ms', (extract(epoch from now() - interval '1 minute') * 1000)::bigint));
select is(pg_temp.quota(745044), 12, 'after expiration the quota falls back to the city pack');

select public.apply_revenuecat_event(jsonb_build_object(
  'id', 'evt-8', 'type', 'RENEWAL', 'product_id', 'plus_yearly',
  'app_user_id', '00000000-0000-4000-8000-0000000000c1', 'original_transaction_id', 'sub-1',
  'expiration_at_ms', (extract(epoch from now() + interval '1 year') * 1000)::bigint));
select is(pg_temp.quota(745044), null, 'a renewal restores Plus');

-- ── Robustness ──────────────────────────────────────────────────────────────
select is(public.apply_revenuecat_event('{
  "id": "evt-9", "type": "INITIAL_PURCHASE", "product_id": "plus_yearly",
  "app_user_id": "$RCAnonymousID:abc"}'),
  'ignored', 'anonymous RevenueCat ids are ignored');
select is(public.apply_revenuecat_event('{"id": "evt-10", "type": "TEST"}'), 'ignored', 'test events are acknowledged');
select is((select count(*) from public.purchase_events)::int, 10, 'every event is logged exactly once');

select * from finish();
rollback;
