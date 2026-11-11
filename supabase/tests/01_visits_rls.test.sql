begin;
select plan(19);

-- Two accounts
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000001', 'a@example.test'),
  ('00000000-0000-4000-8000-000000000002', 'b@example.test');

select is((select count(*) from public.profiles
            where user_id in ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002'))::int,
          2, 'a profile is created for every new account');

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

-- Anonymous visitors cannot touch user data
set local role anon;
select throws_ok($$ select * from public.visits $$, '42501', null, 'anon cannot read visits');
select throws_ok($$ select public.sync_visits('[]') $$, '42501', null, 'anon cannot call sync_visits');
reset role;

-- User A syncs two stamps (745044 = İstanbul, 323786 = Ankara)
select pg_temp.login('00000000-0000-4000-8000-000000000001');
select is(
  (select count(*) from public.sync_visits('[
     {"city_id": 745044, "op": "upsert", "visited_at": "2026-05-01", "at": "2026-05-01T10:00:00Z"},
     {"city_id": 323786, "op": "upsert", "visited_at": "2026-05-02", "at": "2026-05-02T10:00:00Z"},
     {"city_id": 999999999, "op": "upsert", "visited_at": "2026-05-02", "at": "2026-05-02T10:00:00Z"}
   ]'))::int,
  2, 'sync stores the stamps and ignores unknown cities');
select is((select visited_at from public.visits where city_id = 745044), '2026-05-01'::date, 'visit date is kept');

-- Idempotent
select is((select count(*) from public.sync_visits('[
     {"city_id": 745044, "op": "upsert", "visited_at": "2026-05-01", "at": "2026-05-01T10:00:00Z"}]'))::int,
  2, 'repeating a sync does not duplicate stamps');

-- Last write wins
select is((select count(*) from public.sync_visits('[
     {"city_id": 745044, "op": "delete", "visited_at": null, "at": "2026-04-01T00:00:00Z"}]'))::int,
  2, 'a delete older than the stamp is ignored');
select is((select count(*) from public.sync_visits('[
     {"city_id": 745044, "op": "delete", "visited_at": null, "at": "2026-06-01T00:00:00Z"}]'))::int,
  1, 'a newer delete removes the stamp');
select is((select count(*) from public.sync_visits('[
     {"city_id": 323786, "op": "upsert", "visited_at": "2020-01-01", "at": "2026-01-01T00:00:00Z"}]'))::int,
  1, 'an older upsert returns the unchanged server state');
select is((select visited_at from public.visits where city_id = 323786), '2026-05-02'::date,
  'an older upsert does not overwrite a newer one');

-- Direct table access is limited to own rows
select throws_ok(
  $$ insert into public.visits (user_id, city_id) values ('00000000-0000-4000-8000-000000000002', 745044) $$,
  '42501', null, 'A cannot insert a visit for B');
select throws_ok(
  $$ update public.profiles set last_active_at = now() - interval '10 years' $$,
  '42501', null, 'users cannot edit last_active_at');
select lives_ok($$ update public.profiles set locale = 'en' $$, 'users can change their own locale');

-- User B sees and changes nothing of A
select pg_temp.login('00000000-0000-4000-8000-000000000002');
select is((select count(*) from public.visits)::int, 0, 'B cannot read A''s visits');
select is((select count(*) from public.profiles)::int, 1, 'B sees only their own profile');
select is((select locale from public.profiles), 'tr', 'A''s locale change did not affect B');
update public.visits set visited_at = '1999-01-01';
delete from public.visits;
select is((select count(*) from public.sync_visits('[]'))::int, 0, 'B has no visits of their own');

select pg_temp.logout();
select is((select count(*) from public.visits where user_id = '00000000-0000-4000-8000-000000000001')::int,
  1, 'A''s visits survived B''s update/delete attempts');

-- Account deletion cascades
delete from auth.users where id = '00000000-0000-4000-8000-000000000001';
select is(
  (select count(*) from public.visits where user_id = '00000000-0000-4000-8000-000000000001')::int
  + (select count(*) from public.profiles where user_id = '00000000-0000-4000-8000-000000000001')::int,
  0, 'deleting the account removes its visits and profile');

select * from finish();
rollback;
