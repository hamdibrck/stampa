begin;
select plan(12);

select has_table('public', 'countries', 'countries table exists');
select has_table('public', 'cities', 'cities table exists');

-- Seed content (supabase/seed/*.sql)
select cmp_ok((select count(*) from public.cities)::int, '>', 5000, 'seed loaded more than 5000 cities');
select is(
  (select count(*) from public.cities where country_iso2 = 'TR' and is_active)::int, 81,
  'Türkiye has exactly 81 cities (one per province)');
select is(
  (select count(distinct plate_code) from public.cities where country_iso2 = 'TR')::int, 81,
  'Türkiye plate codes are unique');
select is(
  (select city_count from public.countries where iso2 = 'TR'), 81,
  'countries.city_count for TR is 81');
select is(
  (select count(*) from public.countries c
    where c.city_count <> (select count(*) from public.cities x where x.country_iso2 = c.iso2 and x.is_active))::int,
  0, 'city_count matches the cities table for every country');
select is(
  (select name_tr from public.cities where country_iso2 = 'TR' and plate_code = '34'), 'İstanbul',
  'plate 34 is İstanbul');

-- RLS: readable by everyone, writable by nobody through the API roles
set local role anon;
select cmp_ok((select count(*) from public.cities)::int, '>', 5000, 'anon can read cities');
select throws_ok(
  $$ insert into public.countries (iso2, iso3, name_tr, name_en) values ('ZZ', 'ZZZ', 'x', 'x') $$,
  '42501', null, 'anon cannot insert countries');
set local role authenticated;
select throws_ok(
  $$ update public.cities set name_tr = 'hack' where plate_code = '34' $$,
  '42501', null, 'authenticated cannot update cities');
select throws_ok(
  $$ delete from public.cities $$,
  '42501', null, 'authenticated cannot delete cities');
reset role;

select * from finish();
rollback;
