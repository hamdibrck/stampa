-- Community statistics: "X% of users have been here".
-- Aggregated every 15 minutes by pg_cron; requests never count raw visits.
--   visitor_share = active users who visited the city / users active in the last 90 days
-- Only aggregates leave the database, and only when at least 20 users are behind a number
-- (k-anonymity, docs/DECISIONS.md D10).

create table public.city_stats (
  city_id       integer primary key references public.cities (id),
  visitor_count integer not null check (visitor_count >= 0),
  visitor_share double precision not null check (visitor_share between 0 and 1),
  updated_at    timestamptz not null default now()
);

create table public.country_stats (
  country_iso2       text primary key references public.countries (iso2),
  visitor_count      integer not null check (visitor_count >= 0),
  avg_visited_cities double precision not null check (avg_visited_cities >= 0),
  updated_at         timestamptz not null default now()
);

-- Raw aggregates (including exact counts) are not readable through the API.
alter table public.city_stats enable row level security;
alter table public.country_stats enable row level security;
revoke all on public.city_stats, public.country_stats from anon, authenticated;

create function public.k_anonymity_threshold()
returns integer language sql immutable set search_path = '' as $$ select 20 $$;

create function public.stats_active_window()
returns interval language sql immutable set search_path = '' as $$ select interval '90 days' $$;

create function public.refresh_stats()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_users integer;
begin
  select count(*) into active_users
    from public.profiles p
   where p.last_active_at > now() - public.stats_active_window();

  delete from public.city_stats where true;
  delete from public.country_stats where true;

  if active_users = 0 then
    return;
  end if;

  insert into public.city_stats (city_id, visitor_count, visitor_share, updated_at)
  select v.city_id, count(*)::integer, count(*)::double precision / active_users, now()
    from public.visits v
    join public.profiles p on p.user_id = v.user_id
   where p.last_active_at > now() - public.stats_active_window()
   group by v.city_id;

  insert into public.country_stats (country_iso2, visitor_count, avg_visited_cities, updated_at)
  select per_user.country_iso2, count(*)::integer, avg(per_user.cities), now()
    from (
      select c.country_iso2, v.user_id, count(*) as cities
        from public.visits v
        join public.profiles p on p.user_id = v.user_id
        join public.cities c on c.id = v.city_id and c.is_active
       where p.last_active_at > now() - public.stats_active_window()
       group by c.country_iso2, v.user_id
    ) per_user
   group by per_user.country_iso2;
end;
$$;

revoke execute on function public.refresh_stats() from public, anon, authenticated;

-- Public, k-anonymous views. They run with the owner's rights (security_invoker = false), so the
-- API roles can read them without being able to read the tables underneath. Exact counts are
-- never exposed; shares below the threshold are NULL ("Yeni keşif" in the app).
create view public.city_stats_public
with (security_invoker = false) as
select s.city_id,
       c.country_iso2,
       case when s.visitor_count >= public.k_anonymity_threshold()
            then round(s.visitor_share::numeric, 3)::double precision
       end as visitor_share,
       s.updated_at
  from public.city_stats s
  join public.cities c on c.id = s.city_id;

create view public.country_stats_public
with (security_invoker = false) as
select s.country_iso2,
       case when s.visitor_count >= public.k_anonymity_threshold()
            then round(s.avg_visited_cities::numeric, 1)::double precision
       end as avg_visited_cities,
       s.updated_at
  from public.country_stats s;

revoke all on public.city_stats_public, public.country_stats_public from anon, authenticated;
grant select on public.city_stats_public, public.country_stats_public to anon, authenticated;

-- Refresh every 15 minutes.
create extension if not exists pg_cron;

select cron.unschedule(jobid) from cron.job where jobname = 'refresh-community-stats';
select cron.schedule('refresh-community-stats', '*/15 * * * *', $$select public.refresh_stats()$$);
