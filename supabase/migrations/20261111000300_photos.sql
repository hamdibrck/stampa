-- Photos and the photo quota. The limit is enforced HERE, never in the client:
--   quota(user, city) = 2 free + Σ city_pack.extra_slots, or unlimited while Plus is active.
-- The count comes from storage.objects, so it holds even if a client skips the photos table
-- (docs/DECISIONS.md D9).

create table public.entitlements (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  kind            text not null check (kind in ('plus', 'city_pack')),
  city_id         integer references public.cities (id),
  extra_slots     integer not null default 0 check (extra_slots >= 0),
  expires_at      timestamptz,
  -- Store event that created the row; unique, so webhook retries cannot grant twice.
  source_event_id text not null unique,
  product_id      text,
  transaction_id  text,
  revoked_at      timestamptz,
  created_at      timestamptz not null default now(),
  constraint entitlements_city_only_for_packs check ((kind = 'city_pack') = (city_id is not null))
);

create index entitlements_user_idx on public.entitlements (user_id);
create index entitlements_transaction_idx on public.entitlements (transaction_id);

alter table public.entitlements enable row level security;

-- Read-only for clients; rows are written by the purchase webhook (service role).
create policy "entitlements: owner can read" on public.entitlements
  for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.entitlements from anon;
revoke insert, update, delete, truncate, references, trigger on public.entitlements from authenticated;

create table public.photos (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  city_id      integer not null references public.cities (id),
  storage_path text not null unique,
  width        integer check (width > 0),
  height       integer check (height > 0),
  created_at   timestamptz not null default now()
);

create index photos_user_city_idx on public.photos (user_id, city_id);

alter table public.photos enable row level security;

-- Rows are created/removed by triggers on storage.objects, so they always mirror real files.
create policy "photos: owner can read" on public.photos
  for select to authenticated using (user_id = (select auth.uid()));
create policy "photos: owner can set dimensions" on public.photos
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.photos from anon;
revoke insert, update, delete, truncate, references, trigger on public.photos from authenticated;
grant update (width, height) on public.photos to authenticated;

create function public.free_photo_slots()
returns integer language sql immutable set search_path = '' as $$ select 2 $$;

create function public.has_plus(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.entitlements e
     where e.user_id = p_user
       and e.kind = 'plus'
       and e.revoked_at is null
       and (e.expires_at is null or e.expires_at > now())
  );
$$;

-- NULL means unlimited (Plus).
create function public.photo_quota(p_user uuid, p_city integer)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.has_plus(p_user) then null
    else public.free_photo_slots() + coalesce((
      select sum(e.extra_slots)::integer from public.entitlements e
       where e.user_id = p_user and e.kind = 'city_pack' and e.city_id = p_city
         and e.revoked_at is null
    ), 0)
  end;
$$;

create function public.photo_count(p_user uuid, p_city integer)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from storage.objects o
   where o.bucket_id = 'photos'
     and o.name like p_user::text || '/' || p_city::text || '/%';
$$;

create function public.can_upload_photo(p_user uuid, p_city integer)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  quota integer;
begin
  -- Serialise concurrent uploads for the same user + city, so two parallel requests cannot
  -- both pass the check.
  perform pg_advisory_xact_lock(hashtextextended(p_user::text || ':' || p_city::text, 0));
  quota := public.photo_quota(p_user, p_city);
  return quota is null or public.photo_count(p_user, p_city) < quota;
end;
$$;

-- Object names must be "<user uuid>/<city id>/<uuid>.jpg|webp".
create function public.photo_path_city(p_name text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9]{1,9}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|webp)$'
    then split_part(p_name, '/', 2)::integer
  end;
$$;

-- Single gate for the Storage upload policy.
create function public.photo_upload_allowed(p_name text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  city integer := public.photo_path_city(p_name);
begin
  if uid is null or city is null then return false; end if;
  if split_part(p_name, '/', 1) <> uid::text then return false; end if;
  if not exists (select 1 from public.cities c where c.id = city) then return false; end if;
  return public.can_upload_photo(uid, city);
end;
$$;

-- What the app shows: used / quota for one city (quota NULL = unlimited).
create function public.my_photo_quota(p_city integer)
returns table (used integer, quota integer, has_plus boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select public.photo_count((select auth.uid()), p_city),
         public.photo_quota((select auth.uid()), p_city),
         public.has_plus((select auth.uid()));
$$;

revoke execute on function
  public.has_plus(uuid), public.photo_quota(uuid, integer), public.photo_count(uuid, integer),
  public.can_upload_photo(uuid, integer), public.photo_upload_allowed(text),
  public.my_photo_quota(integer)
  from public, anon;
revoke execute on function
  public.has_plus(uuid), public.photo_quota(uuid, integer), public.photo_count(uuid, integer),
  public.can_upload_photo(uuid, integer)
  from authenticated;
grant execute on function public.photo_upload_allowed(text), public.my_photo_quota(integer)
  to authenticated;

-- Private bucket: 5 MB per file, JPEG/WebP only. Files are served through signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 5242880, array['image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "photos bucket: owner can upload within quota" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and public.photo_upload_allowed(name));

create policy "photos bucket: owner can read" on storage.objects
  for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "photos bucket: owner can delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
-- No UPDATE policy on purpose: files cannot be overwritten or moved between cities.

-- Keep public.photos in step with the bucket.
create function public.on_photo_object_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  city integer := public.photo_path_city(new.name);
begin
  if new.bucket_id = 'photos' and city is not null then
    insert into public.photos (user_id, city_id, storage_path)
    values (split_part(new.name, '/', 1)::uuid, city, new.name)
    on conflict (storage_path) do nothing;
  end if;
  return new;
end;
$$;

create function public.on_photo_object_deleted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.bucket_id = 'photos' then
    delete from public.photos where storage_path = old.name;
  end if;
  return old;
end;
$$;

create trigger photos_object_created
  after insert on storage.objects
  for each row execute function public.on_photo_object_created();

create trigger photos_object_deleted
  after delete on storage.objects
  for each row execute function public.on_photo_object_deleted();

revoke execute on function public.on_photo_object_created(), public.on_photo_object_deleted()
  from public, anon, authenticated;
