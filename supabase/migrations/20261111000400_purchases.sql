-- In-app purchases (RevenueCat → webhook Edge Function → apply_revenuecat_event).
--   city_pack_10 : +10 photos for ONE city, permanent. Sold as a consumable in the stores so it can
--                  be bought once per city; made permanent here (docs/DECISIONS.md D7).
--   plus_yearly  : unlimited photos everywhere while the subscription is active.
-- RevenueCat app_user_id = auth.users.id.

-- The client records which city a pack is for right before it starts the purchase.
create table public.purchase_intents (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  city_id     integer not null references public.cities (id),
  product_id  text not null default 'city_pack_10',
  created_at  timestamptz not null default now(),
  consumed_at timestamptz
);

create index purchase_intents_open_idx on public.purchase_intents (user_id, created_at desc)
  where consumed_at is null;

alter table public.purchase_intents enable row level security;

create policy "purchase intents: owner can read" on public.purchase_intents
  for select to authenticated using (user_id = (select auth.uid()));
create policy "purchase intents: owner can create" on public.purchase_intents
  for insert to authenticated with check (user_id = (select auth.uid()));
revoke all on public.purchase_intents from anon;
revoke update, delete, truncate, references, trigger on public.purchase_intents from authenticated;

-- Every webhook event, processed exactly once (primary key = RevenueCat event id).
create table public.purchase_events (
  event_id    text primary key,
  user_id     uuid,
  type        text not null,
  product_id  text,
  -- applied | ignored | unmatched (a city pack without a purchase intent; see claim_city_pack)
  status      text not null,
  payload     jsonb not null,
  created_at  timestamptz not null default now()
);

alter table public.purchase_events enable row level security;
revoke all on public.purchase_events from anon, authenticated;

create function public.city_pack_slots(p_product text)
returns integer
language sql
immutable
set search_path = ''
as $$ select case p_product when 'city_pack_10' then 10 end $$;

create function public.apply_revenuecat_event(p_event jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id text := p_event ->> 'id';
  v_type     text := p_event ->> 'type';
  v_product  text := p_event ->> 'product_id';
  v_txn      text := coalesce(p_event ->> 'original_transaction_id', p_event ->> 'transaction_id');
  v_user     uuid;
  v_expires  timestamptz;
  v_slots    integer := public.city_pack_slots(p_event ->> 'product_id');
  v_intent   public.purchase_intents%rowtype;
  v_status   text := 'ignored';
begin
  if v_event_id is null or v_type is null then
    raise exception 'event id and type are required' using errcode = '22023';
  end if;

  -- Idempotency: a retried webhook is acknowledged without doing anything again.
  if exists (select 1 from public.purchase_events where event_id = v_event_id) then
    return 'duplicate';
  end if;

  begin
    v_user := (p_event ->> 'app_user_id')::uuid;
  exception when invalid_text_representation then
    v_user := null;  -- anonymous RevenueCat ids are never granted anything
  end;
  if v_user is not null and not exists (select 1 from auth.users u where u.id = v_user) then
    v_user := null;
  end if;

  if p_event ->> 'expiration_at_ms' is not null then
    v_expires := to_timestamp((p_event ->> 'expiration_at_ms')::double precision / 1000);
  end if;

  if v_user is not null then
    if v_type = 'NON_RENEWING_PURCHASE' and v_slots is not null then
      select * into v_intent
        from public.purchase_intents i
       where i.user_id = v_user and i.product_id = v_product and i.consumed_at is null
         and i.created_at > now() - interval '7 days'
       order by i.created_at desc
       limit 1
       for update;
      if found then
        insert into public.entitlements
          (user_id, kind, city_id, extra_slots, source_event_id, product_id, transaction_id)
        values (v_user, 'city_pack', v_intent.city_id, v_slots, v_event_id, v_product, v_txn);
        update public.purchase_intents set consumed_at = now() where id = v_intent.id;
        v_status := 'applied';
      else
        v_status := 'unmatched';
      end if;

    elsif v_type in ('INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'PRODUCT_CHANGE', 'SUBSCRIPTION_EXTENDED')
          and v_product like 'plus_%' then
      insert into public.entitlements
        (user_id, kind, expires_at, source_event_id, product_id, transaction_id)
      values (v_user, 'plus', v_expires, v_event_id, v_product, v_txn);
      v_status := 'applied';

    elsif v_type = 'EXPIRATION' and v_product like 'plus_%' then
      update public.entitlements e
         set expires_at = least(coalesce(e.expires_at, now()), coalesce(v_expires, now()), now())
       where e.user_id = v_user and e.kind = 'plus' and e.revoked_at is null;
      v_status := 'applied';

    elsif v_type = 'CANCELLATION' then
      -- A plain cancellation only stops auto-renew: access continues until expires_at.
      -- A refund (CUSTOMER_SUPPORT) takes the purchase back immediately.
      if p_event ->> 'cancel_reason' = 'CUSTOMER_SUPPORT' then
        update public.entitlements e
           set revoked_at = now()
         where e.user_id = v_user and e.revoked_at is null
           and (e.transaction_id = v_txn or (e.kind = 'plus' and v_product like 'plus_%'));
        v_status := 'applied';
      end if;
    end if;
  end if;

  insert into public.purchase_events (event_id, user_id, type, product_id, status, payload)
  values (v_event_id, v_user, v_type, v_product, v_status, p_event);

  return v_status;
end;
$$;

-- Safety net: a paid city pack whose intent was lost can be assigned to a city by its buyer.
create function public.claim_city_pack(p_city integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  ev public.purchase_events%rowtype;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if not exists (select 1 from public.cities c where c.id = p_city) then
    return false;
  end if;
  select * into ev from public.purchase_events e
   where e.user_id = uid and e.status = 'unmatched'
   order by e.created_at
   limit 1
   for update;
  if not found then
    return false;
  end if;
  insert into public.entitlements
    (user_id, kind, city_id, extra_slots, source_event_id, product_id, transaction_id)
  values (uid, 'city_pack', p_city, public.city_pack_slots(ev.product_id), ev.event_id, ev.product_id,
          coalesce(ev.payload ->> 'original_transaction_id', ev.payload ->> 'transaction_id'));
  update public.purchase_events set status = 'applied' where event_id = ev.event_id;
  return true;
end;
$$;

revoke execute on function public.apply_revenuecat_event(jsonb) from public, anon, authenticated;
grant execute on function public.apply_revenuecat_event(jsonb) to service_role;
revoke execute on function public.claim_city_pack(integer) from public, anon;
grant execute on function public.claim_city_pack(integer) to authenticated;
