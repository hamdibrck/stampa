-- Reference data: countries and cities. World-readable, written only by the seed (service role).
-- cities.id IS the GeoNames id (docs/DECISIONS.md D2): the app ships the same ids offline, and
-- future per-city tables (ratings, comments) reference cities(id) directly.

create table public.countries (
  iso2       text primary key check (iso2 ~ '^[A-Z]{2}$'),
  iso3       text not null,
  name_tr    text not null,
  name_en    text not null,
  city_count integer not null default 0 check (city_count >= 0),
  -- ISO2 of the map polygon that draws this country (overseas territories point at their parent).
  geom_ref   text
);

create table public.cities (
  id           integer primary key,
  geonames_id  integer not null unique,
  country_iso2 text not null references public.countries (iso2),
  name_tr      text not null,
  name_en      text not null,
  name_ascii   text not null,
  search_key   text not null,
  admin1       text,
  plate_code   text,
  lat          double precision not null check (lat between -90 and 90),
  lon          double precision not null check (lon between -180 and 180),
  population   integer not null default 0,
  is_capital   boolean not null default false,
  summary_tr   text,
  summary_en   text,
  -- false = dropped from the dataset by a later seed; kept so existing visits stay valid.
  is_active    boolean not null default true,
  constraint cities_id_is_geonames_id check (id = geonames_id)
);

create index cities_country_idx on public.cities (country_iso2);

alter table public.countries enable row level security;
alter table public.cities enable row level security;

create policy "countries are readable by everyone"
  on public.countries for select to anon, authenticated using (true);

create policy "cities are readable by everyone"
  on public.cities for select to anon, authenticated using (true);

revoke insert, update, delete, truncate, references, trigger
  on public.countries, public.cities from anon, authenticated;
