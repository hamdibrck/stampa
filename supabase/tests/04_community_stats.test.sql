begin;
select plan(17);

-- 25 active users + 5 users inactive for more than 90 days
insert into auth.users (id, email)
select ('00000000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid, 'u' || g || '@example.test'
  from generate_series(1, 30) g;
update public.profiles set last_active_at = now() - interval '120 days'
 where user_id in (select ('00000000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid from generate_series(26, 30) g);

create function pg_temp.visit(first_user integer, last_user integer, city integer) returns void language sql as $$
  insert into public.visits (user_id, city_id)
  select ('00000000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid, city
    from generate_series(first_user, last_user) g;
$$;

select pg_temp.visit(1, 20, 745044);   -- İstanbul: 20 active visitors  → shown
select pg_temp.visit(26, 30, 745044);  --           + 5 inactive users  → not counted
select pg_temp.visit(1, 19, 323786);   -- Ankara:   19 active visitors  → hidden (k = 20)
select pg_temp.visit(1, 5, 2643743);   -- London:    5 visitors         → hidden

select public.refresh_stats();

-- Aggregation
select is((select visitor_count from public.city_stats where city_id = 745044), 20, 'inactive users are not counted');
select is((select visitor_share from public.city_stats where city_id = 745044), 0.8::double precision,
  'share = visitors / users active in the last 90 days (20 / 25)');
select is((select visitor_count from public.country_stats where country_iso2 = 'TR'), 20, 'country visitor count');
select is((select avg_visited_cities from public.country_stats where country_iso2 = 'TR'), 1.95::double precision,
  'country average = cities per visiting user ((19×2 + 1) / 20)');

-- k-anonymity in the public views
select is((select visitor_share from public.city_stats_public where city_id = 745044), 0.8::double precision,
  'a city with 20 visitors shows its share');
select is((select visitor_share from public.city_stats_public where city_id = 323786), null,
  'a city with 19 visitors hides its share (k-anonymity)');
select is((select visitor_share from public.city_stats_public where city_id = 2643743), null,
  'a city with 5 visitors hides its share');
select is((select count(*) from public.city_stats_public where city_id = 2988507)::int, 0,
  'a city nobody visited has no row');
select is((select avg_visited_cities from public.country_stats_public where country_iso2 = 'TR'), 2.0::double precision,
  'country average is shown (rounded) with 20 visitors');
select is((select avg_visited_cities from public.country_stats_public where country_iso2 = 'GB'), null,
  'country average is hidden below the threshold');
select hasnt_column('public', 'city_stats_public', 'visitor_count', 'exact counts are not exposed');

-- API roles: views only
set local role anon;
select is((select visitor_share from public.city_stats_public where city_id = 745044), 0.8::double precision,
  'anon can read the public view');
select throws_ok($$ select * from public.city_stats $$, '42501', null, 'anon cannot read raw city stats');
select throws_ok($$ select * from public.visits $$, '42501', null, 'anon cannot read raw visits');
select throws_ok($$ select public.refresh_stats() $$, '42501', null, 'anon cannot trigger a refresh');
set local role authenticated;
select throws_ok($$ select * from public.country_stats $$, '42501', null, 'authenticated cannot read raw country stats');
reset role;

-- Schedule
select is((select schedule from cron.job where jobname = 'refresh-community-stats'), '*/15 * * * *',
  'stats refresh is scheduled every 15 minutes');

select * from finish();
rollback;
