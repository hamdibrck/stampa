begin;
select plan(27);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000000a', 'a@example.test'),
  ('00000000-0000-4000-8000-00000000000b', 'b@example.test');

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

-- What the Storage API does on upload: INSERT into storage.objects as the signed-in user.
-- This bypasses the app completely, so it proves the limit is enforced by the server.
create function pg_temp.upload(uid uuid, city integer, n integer) returns void language sql as $$
  insert into storage.objects (bucket_id, name, owner_id)
  values ('photos',
          uid::text || '/' || city::text || '/' || '11111111-1111-4111-8111-' || lpad(n::text, 12, '0') || '.jpg',
          uid::text);
$$;

-- The Storage API sets this flag for its own deletes; RLS still decides which rows are visible.
select set_config('storage.allow_delete_query', 'true', true);

select is((select public from storage.buckets where id = 'photos'), false, 'photos bucket is private');

-- ── Free tier: 2 photos per city ────────────────────────────────────────────
select pg_temp.login('00000000-0000-4000-8000-00000000000a');
select is((select quota from public.my_photo_quota(745044)), 2, 'free quota is 2 photos per city');
select lives_ok($$ select pg_temp.upload('00000000-0000-4000-8000-00000000000a', 745044, 1) $$, '1st photo is accepted');
select lives_ok($$ select pg_temp.upload('00000000-0000-4000-8000-00000000000a', 745044, 2) $$, '2nd photo is accepted');
select throws_ok($$ select pg_temp.upload('00000000-0000-4000-8000-00000000000a', 745044, 3) $$,
  '42501', null, '3rd photo is REJECTED by the server even when the client is bypassed');
select is((select used from public.my_photo_quota(745044)), 2, 'used count is 2');
select lives_ok($$ select pg_temp.upload('00000000-0000-4000-8000-00000000000a', 323786, 1) $$,
  'the limit is per city: another city still accepts photos');

-- public.photos mirrors the bucket
select is((select count(*) from public.photos where city_id = 745044)::int, 2, 'photo rows are created with the files');
select throws_ok(
  $$ insert into public.photos (user_id, city_id, storage_path) values ('00000000-0000-4000-8000-00000000000a', 745044, 'x') $$,
  '42501', null, 'clients cannot insert photo rows directly');
select throws_ok(
  $$ insert into public.entitlements (user_id, kind, source_event_id) values ('00000000-0000-4000-8000-00000000000a', 'plus', 'self-granted') $$,
  '42501', null, 'clients cannot grant themselves entitlements');

-- ── Path rules ──────────────────────────────────────────────────────────────
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id) values
     ('photos', '00000000-0000-4000-8000-00000000000b/2643743/11111111-1111-4111-8111-000000000001.jpg', '00000000-0000-4000-8000-00000000000a') $$,
  '42501', null, 'cannot upload into another user''s folder');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id) values
     ('photos', '00000000-0000-4000-8000-00000000000a/999999999/11111111-1111-4111-8111-000000000001.jpg', '00000000-0000-4000-8000-00000000000a') $$,
  '42501', null, 'cannot upload for a city that does not exist');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id) values
     ('photos', '00000000-0000-4000-8000-00000000000a/745044/../evil.jpg', '00000000-0000-4000-8000-00000000000a') $$,
  '42501', null, 'cannot use a malformed path');

-- ── Isolation ───────────────────────────────────────────────────────────────
select pg_temp.login('00000000-0000-4000-8000-00000000000b');
select is((select count(*) from storage.objects where bucket_id = 'photos')::int, 0, 'B cannot see A''s files');
select is((select count(*) from public.photos)::int, 0, 'B cannot see A''s photo rows');
delete from storage.objects where bucket_id = 'photos';
select pg_temp.logout();
select is((select count(*) from storage.objects where bucket_id = 'photos')::int, 3, 'B cannot delete A''s files');

-- ── City pack: +10 for that city only ───────────────────────────────────────
insert into public.entitlements (user_id, kind, city_id, extra_slots, source_event_id, product_id)
values ('00000000-0000-4000-8000-00000000000a', 'city_pack', 745044, 10, 'evt-pack-1', 'city_pack_10');
select pg_temp.login('00000000-0000-4000-8000-00000000000a');
select is((select quota from public.my_photo_quota(745044)), 12, 'city pack raises the quota to 12 for that city');
select is((select quota from public.my_photo_quota(323786)), 2, 'other cities keep the free quota');
select lives_ok($$ select pg_temp.upload('00000000-0000-4000-8000-00000000000a', 745044, g) from generate_series(3, 12) g $$,
  'photos 3–12 are accepted with a city pack');
select throws_ok($$ select pg_temp.upload('00000000-0000-4000-8000-00000000000a', 745044, 13) $$,
  '42501', null, '13th photo is rejected');

-- ── Plus: unlimited everywhere while active ─────────────────────────────────
select pg_temp.logout();
insert into public.entitlements (user_id, kind, expires_at, source_event_id, product_id)
values ('00000000-0000-4000-8000-00000000000a', 'plus', now() + interval '1 year', 'evt-plus-1', 'plus_yearly');
select pg_temp.login('00000000-0000-4000-8000-00000000000a');
select is((select quota from public.my_photo_quota(745044)), null, 'Plus means no quota');
select ok((select has_plus from public.my_photo_quota(745044)), 'Plus is reported as active');
select lives_ok($$ select pg_temp.upload('00000000-0000-4000-8000-00000000000a', 745044, 13) $$, 'Plus accepts further photos');

-- Expired Plus falls back to the purchased/free quota; existing files stay
select pg_temp.logout();
update public.entitlements set expires_at = now() - interval '1 day' where source_event_id = 'evt-plus-1';
select pg_temp.login('00000000-0000-4000-8000-00000000000a');
select is((select quota from public.my_photo_quota(745044)), 12, 'expired Plus falls back to the city pack quota');
select throws_ok($$ select pg_temp.upload('00000000-0000-4000-8000-00000000000a', 745044, 14) $$,
  '42501', null, 'uploads are rejected again after Plus expires');

-- ── Deleting a file frees a slot and removes its row ────────────────────────
delete from storage.objects
 where bucket_id = 'photos' and name like '00000000-0000-4000-8000-00000000000a/323786/%';
select is((select count(*) from public.photos where city_id = 323786)::int, 0, 'deleting a file removes its photo row');
select lives_ok($$ select pg_temp.upload('00000000-0000-4000-8000-00000000000a', 323786, 5) $$, 'the freed slot can be used again');

select pg_temp.logout();
select * from finish();
rollback;
