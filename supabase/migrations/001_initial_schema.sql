begin;

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tcg text not null check (tcg in ('pokemon', 'one_piece', 'lorcana')),
  name text not null check (char_length(trim(name)) between 1 and 200),
  set_name text check (set_name is null or char_length(trim(set_name)) between 1 and 200),
  product_type text not null check (char_length(trim(product_type)) between 1 and 100),
  language text not null check (char_length(trim(language)) between 2 and 50),
  release_date date,
  retail_price_cents integer check (retail_price_cents is null or retail_price_cents >= 0),
  image_url text check (image_url is null or char_length(image_url) <= 2048),
  reprint_risk text not null default 'unknown' check (reprint_risk in ('low', 'medium', 'high', 'unknown')),
  demand_score smallint check (demand_score is null or demand_score between 0 and 100),
  long_term_score smallint check (long_term_score is null or long_term_score between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 200),
  website_url text check (website_url is null or char_length(website_url) <= 2048),
  country text not null check (country ~ '^[A-Z]{2}$'),
  shipping_notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null,
  store_id uuid not null,
  url text not null check (char_length(url) between 1 and 2048),
  price_cents integer not null check (price_cents >= 0),
  shipping_cents integer not null default 0 check (shipping_cents >= 0),
  stock_status text not null default 'unknown' check (stock_status in ('in_stock', 'out_of_stock', 'preorder', 'unknown')),
  available_quantity integer check (available_quantity is null or available_quantity >= 0),
  seller text check (seller is null or char_length(trim(seller)) between 1 and 200),
  country text not null check (country ~ '^[A-Z]{2}$'),
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (product_id, user_id) references public.products(id, user_id) on delete restrict,
  foreign key (store_id, user_id) references public.stores(id, user_id) on delete restrict
);

create table public.price_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid not null,
  price_cents integer not null check (price_cents >= 0),
  stock_status text not null check (stock_status in ('in_stock', 'out_of_stock', 'preorder', 'unknown')),
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (listing_id, user_id) references public.listings(id, user_id) on delete cascade
);

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null,
  quantity integer not null check (quantity > 0),
  unit_cost_cents integer not null check (unit_cost_cents >= 0),
  shipping_cents integer not null default 0 check (shipping_cents >= 0),
  purchase_date date not null,
  source text check (source is null or char_length(trim(source)) between 1 and 200),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (product_id, user_id) references public.products(id, user_id) on delete restrict
);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  purchase_id uuid not null,
  quantity integer not null check (quantity > 0),
  sale_price_cents integer not null check (sale_price_cents >= 0),
  platform_fee_cents integer not null default 0 check (platform_fee_cents >= 0),
  shipping_cents integer not null default 0 check (shipping_cents >= 0),
  packaging_cents integer not null default 0 check (packaging_cents >= 0),
  sale_date date not null,
  platform text check (platform is null or char_length(trim(platform)) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (purchase_id, user_id) references public.purchases(id, user_id) on delete restrict
);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid not null,
  alert_type text not null check (alert_type in ('price_drop', 'back_in_stock', 'target_price', 'manual')),
  price_cents integer check (price_cents is null or price_cents >= 0),
  delivered boolean not null default false,
  delivered_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((delivered and delivered_at is not null) or (not delivered and delivered_at is null)),
  foreign key (listing_id, user_id) references public.listings(id, user_id) on delete cascade
);

create index products_user_id_idx on public.products(user_id);
create index products_user_tcg_idx on public.products(user_id, tcg);
create index stores_user_active_idx on public.stores(user_id, active);
create index listings_user_product_idx on public.listings(user_id, product_id);
create index listings_user_store_idx on public.listings(user_id, store_id);
create index listings_user_stock_idx on public.listings(user_id, stock_status);
create index price_history_listing_recorded_idx on public.price_history(listing_id, recorded_at desc);
create index price_history_user_recorded_idx on public.price_history(user_id, recorded_at desc);
create index purchases_user_product_idx on public.purchases(user_id, product_id);
create index purchases_user_date_idx on public.purchases(user_id, purchase_date desc);
create index sales_user_purchase_idx on public.sales(user_id, purchase_id);
create index sales_user_date_idx on public.sales(user_id, sale_date desc);
create index alerts_user_delivery_idx on public.alerts(user_id, delivered, created_at desc);
create index alerts_listing_idx on public.alerts(listing_id);

create trigger products_set_updated_at before update on public.products for each row execute function public.set_updated_at();
create trigger stores_set_updated_at before update on public.stores for each row execute function public.set_updated_at();
create trigger listings_set_updated_at before update on public.listings for each row execute function public.set_updated_at();
create trigger price_history_set_updated_at before update on public.price_history for each row execute function public.set_updated_at();
create trigger purchases_set_updated_at before update on public.purchases for each row execute function public.set_updated_at();
create trigger sales_set_updated_at before update on public.sales for each row execute function public.set_updated_at();
create trigger alerts_set_updated_at before update on public.alerts for each row execute function public.set_updated_at();

alter table public.products enable row level security;
alter table public.stores enable row level security;
alter table public.listings enable row level security;
alter table public.price_history enable row level security;
alter table public.purchases enable row level security;
alter table public.sales enable row level security;
alter table public.alerts enable row level security;

create policy "Users manage own products" on public.products for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users manage own stores" on public.stores for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users manage own listings" on public.listings for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users manage own price history" on public.price_history for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users manage own purchases" on public.purchases for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users manage own sales" on public.sales for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users manage own alerts" on public.alerts for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

commit;
