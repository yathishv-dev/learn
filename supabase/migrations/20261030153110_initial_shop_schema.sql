-- All money is stored in integer paise. Each owner has one shop.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  owner_name text not null check (char_length(trim(owner_name)) between 1 and 80),
  shop_name text not null check (char_length(trim(shop_name)) between 1 and 120),
  ui_language text not null default 'en' check (ui_language in ('en', 'kn')),
  ai_language text not null default 'en' check (ai_language in ('en', 'kn')),
  auto_speak boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  kannada_name text not null default '' check (char_length(kannada_name) <= 120),
  category text not null default 'General' check (char_length(category) <= 60),
  unit text not null default 'piece' check (unit in ('piece', 'kg', 'litre', 'pack')),
  stock numeric(12,3) not null default 0 check (stock between 0 and 1000000),
  price_paise bigint not null check (price_paise between 0 and 1000000000),
  cost_paise bigint not null default 0 check (cost_paise between 0 and 1000000000),
  low_stock_threshold numeric(12,3) not null default 5 check (low_stock_threshold between 0 and 1000000),
  active boolean not null default true,
  version integer not null default 0,
  created_at timestamptz not null default now(),
  unique(id, user_id)
);
create unique index products_owner_name on public.products(user_id, lower(trim(name))) where active;
create index products_owner on public.products(user_id, active);

create table public.sales (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  product_id uuid not null,
  product_name text not null,
  unit text not null,
  quantity numeric(12,3) not null check (quantity > 0 and quantity <= 1000000),
  unit_price_paise bigint not null,
  total_paise bigint not null,
  cost_paise bigint not null,
  sale_date date not null default (now() at time zone 'Asia/Kolkata')::date,
  created_at timestamptz not null default now(),
  foreign key (product_id, user_id) references public.products(id, user_id),
  check (sale_date <= (now() at time zone 'Asia/Kolkata')::date)
);
create index sales_owner_date on public.sales(user_id, sale_date desc, created_at desc);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  description text not null check (char_length(trim(description)) between 1 and 240),
  category text not null default 'other' check (category in ('rent','utilities','transport','supplies','salary','other')),
  amount_paise bigint not null check (amount_paise > 0 and amount_paise <= 1000000000),
  expense_date date not null default (now() at time zone 'Asia/Kolkata')::date,
  created_at timestamptz not null default now(),
  check (expense_date <= (now() at time zone 'Asia/Kolkata')::date)
);
create index expenses_owner_date on public.expenses(user_id, expense_date desc, created_at desc);

create table public.ai_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index ai_requests_owner_date on public.ai_requests(user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.sales enable row level security;
alter table public.expenses enable row level security;
alter table public.ai_requests enable row level security;

revoke all on public.profiles, public.products, public.sales, public.expenses, public.ai_requests from anon, authenticated;
grant select, insert, update on public.profiles, public.products to authenticated;
grant select, insert on public.sales, public.ai_requests to authenticated;
grant select, insert, update, delete on public.expenses to authenticated;
grant usage on sequence public.ai_requests_id_seq to authenticated;

create policy profile_read on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy profile_insert on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy profile_update on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy product_read on public.products for select to authenticated using ((select auth.uid()) = user_id);
create policy product_insert on public.products for insert to authenticated with check ((select auth.uid()) = user_id);
create policy product_update on public.products for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy sale_read on public.sales for select to authenticated using ((select auth.uid()) = user_id);
create policy sale_insert on public.sales for insert to authenticated with check ((select auth.uid()) = user_id);
create policy expense_read on public.expenses for select to authenticated using ((select auth.uid()) = user_id);
create policy expense_insert on public.expenses for insert to authenticated with check ((select auth.uid()) = user_id);
create policy expense_update on public.expenses for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy expense_delete on public.expenses for delete to authenticated using ((select auth.uid()) = user_id);
create policy ai_request_read on public.ai_requests for select to authenticated using ((select auth.uid()) = user_id);
create policy ai_request_insert on public.ai_requests for insert to authenticated with check ((select auth.uid()) = user_id);

create function public.bump_product_version() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  new.version := old.version + 1;
  return new;
end;
$$;
create trigger bump_product_version_before_update before update on public.products for each row execute function public.bump_product_version();

-- Enforce stock and snapshot amounts even if a client inserts directly.
-- SECURITY INVOKER preserves the caller's row-level security policies.
create function public.prepare_sale() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare item public.products;
begin
  if new.quantity <= 0 or new.quantity > 1000000 then raise exception 'INVALID_QUANTITY'; end if;
  if new.sale_date > (now() at time zone 'Asia/Kolkata')::date then raise exception 'INVALID_DATE'; end if;
  select * into item from public.products
    where id = new.product_id and user_id = auth.uid() and active for update;
  if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;
  if item.stock < new.quantity then raise exception 'INSUFFICIENT_STOCK'; end if;
  new.user_id := auth.uid();
  new.product_name := item.name;
  new.unit := item.unit;
  new.unit_price_paise := item.price_paise;
  new.total_paise := round(item.price_paise * new.quantity);
  new.cost_paise := round(item.cost_paise * new.quantity);
  update public.products set stock = stock - new.quantity where id = item.id and user_id = auth.uid();
  return new;
end;
$$;
create trigger prepare_sale_before_insert before insert on public.sales for each row execute function public.prepare_sale();

-- A request UUID makes a retried save idempotent. Lock the product first so
-- concurrent requests with the same UUID cannot decrement stock twice.
create function public.record_sale(p_id uuid, p_product_id uuid, p_quantity numeric, p_date date, p_price_paise bigint)
returns public.sales language plpgsql security invoker set search_path = '' as $$
declare existing public.sales; result public.sales; current_price bigint;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_quantity is null or p_quantity <= 0 or p_quantity > 1000000 or p_quantity <> round(p_quantity, 3) then raise exception 'INVALID_QUANTITY'; end if;
  if p_date is null or p_date > (now() at time zone 'Asia/Kolkata')::date then raise exception 'INVALID_DATE'; end if;
  select price_paise into current_price from public.products where id = p_product_id and user_id = auth.uid() for update;
  if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;
  select * into existing from public.sales where id = p_id and user_id = auth.uid();
  if found then
    if existing.product_id <> p_product_id or existing.quantity <> p_quantity or existing.sale_date <> p_date or existing.unit_price_paise <> p_price_paise then raise exception 'REQUEST_ID_REUSED'; end if;
    return existing;
  end if;
  if p_price_paise is null or current_price <> p_price_paise then raise exception 'PRICE_CHANGED'; end if;
  insert into public.sales(id, product_id, quantity, sale_date)
    values (p_id, p_product_id, p_quantity, p_date) returning * into result;
  return result;
end;
$$;

-- Aggregation happens inside Postgres, avoiding client-side row limits.
create function public.business_report(p_start date, p_end date)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare result jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_start is null or p_end is null or p_end < p_start or p_end - p_start > 366 then raise exception 'INVALID_DATE_RANGE'; end if;
  with period_sales as (
    select * from public.sales where user_id = auth.uid() and sale_date between p_start and p_end
  ), period_expenses as (
    select * from public.expenses where user_id = auth.uid() and expense_date between p_start and p_end
  ), totals as (
    select coalesce(sum(total_paise),0) as revenue, coalesce(sum(cost_paise),0) as costs, count(*) as transactions, coalesce(sum(quantity),0) as units from period_sales
  ), expense_total as (
    select coalesce(sum(amount_paise),0) as amount from period_expenses
  ), daily_sales as (
    select sale_date as day, sum(total_paise) as amount from period_sales group by sale_date
  ), daily_expenses as (
    select expense_date as day, sum(amount_paise) as amount from period_expenses group by expense_date
  ), daily as (
    select d::date as date, coalesce(s.amount,0) as sales_paise, coalesce(e.amount,0) as expenses_paise
    from generate_series(p_start::timestamp,p_end::timestamp,interval '1 day') d
    left join daily_sales s on s.day=d::date left join daily_expenses e on e.day=d::date
  ), top_products as (
    select product_name as name, sum(quantity) as quantity, sum(total_paise) as sales_paise from period_sales
    group by product_name order by sales_paise desc limit 5
  ), expense_categories as (
    select category, sum(amount_paise) as amount_paise from period_expenses group by category order by amount_paise desc
  ), low_stock as (
    select id,name,kannada_name,stock,unit,low_stock_threshold from public.products
    where user_id=auth.uid() and active and stock<=low_stock_threshold order by stock, name
  )
  select jsonb_build_object(
    'start_date',p_start,'end_date',p_end,
    'sales_paise',t.revenue,'expenses_paise',e.amount,'cost_of_goods_paise',t.costs,
    'profit_paise',t.revenue-t.costs-e.amount,'transactions',t.transactions,'units_sold',t.units,
    'active_products',(select count(*) from public.products where user_id=auth.uid() and active),
    'stock_value_paise',(select coalesce(sum(round(stock*cost_paise)),0) from public.products where user_id=auth.uid() and active),
    'low_stock',coalesce((select jsonb_agg(to_jsonb(l)) from low_stock l),'[]'::jsonb),
    'daily',coalesce((select jsonb_agg(to_jsonb(d) order by date) from daily d),'[]'::jsonb),
    'top_products',coalesce((select jsonb_agg(to_jsonb(p)) from top_products p),'[]'::jsonb),
    'expense_categories',coalesce((select jsonb_agg(to_jsonb(c)) from expense_categories c),'[]'::jsonb)
  ) into result from totals t cross join expense_total e;
  return result;
end;
$$;

-- A database-backed limit works across stateless API instances.
create function public.consume_ai_request() returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  perform id from public.profiles where id=auth.uid() for update;
  if not found then raise exception 'PROFILE_NOT_FOUND'; end if;
  if (select count(*) from public.ai_requests where user_id=auth.uid() and created_at > now()-interval '1 minute') >= 20
     or (select count(*) from public.ai_requests where user_id=auth.uid() and created_at > now()-interval '1 day') >= 200 then
    raise exception 'AI_RATE_LIMIT';
  end if;
  insert into public.ai_requests(user_id) values(auth.uid());
end;
$$;

revoke all on function public.prepare_sale() from public,anon,authenticated;
revoke all on function public.bump_product_version() from public,anon,authenticated;
revoke all on function public.record_sale(uuid,uuid,numeric,date,bigint) from public,anon;
revoke all on function public.business_report(date,date) from public,anon;
revoke all on function public.consume_ai_request() from public,anon;
grant execute on function public.record_sale(uuid,uuid,numeric,date,bigint) to authenticated;
grant execute on function public.business_report(date,date) to authenticated;
grant execute on function public.consume_ai_request() to authenticated;
