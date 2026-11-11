-- Per-user data. Pattern used by every user-owned table (and by future ratings/comments):
--   * user_id references auth.users ON DELETE CASCADE  → account deletion removes everything
--   * city_id references cities(id)
--   * RLS: a row is visible and writable only by its owner (user_id = auth.uid())

create table public.profiles (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  display_name   text check (char_length(display_name) <= 80),
  locale         text not null default 'tr' check (locale in ('tr', 'en')),
  -- Drives the "active users" denominator of community stats (docs/DECISIONS.md D10).
  last_active_at timestamptz not null default now(),
  created_at     timestamptz not null default now()
);

create table public.visits (
  user_id    uuid not null references auth.users (id) on delete cascade,
  city_id    integer not null references public.cities (id),
  visited_at date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, city_id)
);

create index visits_city_idx on public.visits (city_id);

alter table public.profiles enable row level security;
alter table public.visits enable row level security;

create policy "profiles: owner can read" on public.profiles
  for select to authenticated using (user_id = (select auth.uid()));
create policy "profiles: owner can update" on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "visits: owner can read" on public.visits
  for select to authenticated using (user_id = (select auth.uid()));
create policy "visits: owner can insert" on public.visits
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "visits: owner can update" on public.visits
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "visits: owner can delete" on public.visits
  for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.profiles, public.visits from anon;
revoke insert, delete, truncate, references, trigger on public.profiles from authenticated;
revoke update on public.profiles from authenticated;
grant update (display_name, locale) on public.profiles to authenticated;
revoke truncate, references, trigger on public.visits from authenticated;

-- A profile row is created with every account.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name, locale)
  values (
    new.id,
    nullif(left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''), 80), ''),
    case when new.raw_user_meta_data ->> 'locale' = 'en' then 'en' else 'tr' end
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.touch_last_active()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles
     set last_active_at = now()
   where user_id = (select auth.uid())
     and last_active_at < now() - interval '1 hour';
$$;

-- Offline-first sync (docs/DECISIONS.md D6): the client pushes its queued operations and gets the
-- full server state back. Last write wins per city, decided by the client timestamp `at`.
--   ops: [{ "city_id": 745044, "op": "upsert" | "delete", "visited_at": "2026-11-11" | null, "at": "<iso>" }]
create function public.sync_visits(ops jsonb default '[]'::jsonb)
returns table (city_id integer, visited_at date, updated_at timestamptz)
language plpgsql
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  uid uuid := (select auth.uid());
  op jsonb;
  op_at timestamptz;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if jsonb_typeof(ops) <> 'array' or jsonb_array_length(ops) > 20000 then
    raise exception 'ops must be an array of at most 20000 operations' using errcode = '22023';
  end if;

  for op in select value from jsonb_array_elements(ops)
  loop
    -- Never trust a client clock that runs ahead.
    op_at := least(coalesce((op ->> 'at')::timestamptz, now()), now());
    if op ->> 'op' = 'upsert' then
      insert into public.visits as v (user_id, city_id, visited_at, updated_at)
      select uid, c.id, coalesce((op ->> 'visited_at')::date, current_date), op_at
        from public.cities c
       where c.id = (op ->> 'city_id')::integer          -- unknown cities are ignored
      on conflict on constraint visits_pkey do update
        set visited_at = excluded.visited_at, updated_at = excluded.updated_at
        where v.updated_at <= excluded.updated_at;
    elsif op ->> 'op' = 'delete' then
      delete from public.visits v
       where v.user_id = uid
         and v.city_id = (op ->> 'city_id')::integer
         and v.updated_at <= op_at;
    end if;
  end loop;

  perform public.touch_last_active();

  return query
    select v.city_id, v.visited_at, v.updated_at from public.visits v where v.user_id = uid;
end;
$$;

revoke execute on function public.sync_visits(jsonb) from public, anon;
grant execute on function public.sync_visits(jsonb) to authenticated;
revoke execute on function public.touch_last_active() from public, anon;
grant execute on function public.touch_last_active() to authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
