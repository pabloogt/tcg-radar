begin;

create table public.investment_portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  budget_cents integer not null check (budget_cents between 1000 and 10000000),
  allocated_cents integer not null check (allocated_cents >= 0 and allocated_cents <= budget_cents),
  remaining_cents integer not null check (remaining_cents >= 0 and remaining_cents = budget_cents - allocated_cents),
  horizon text not null check (horizon in ('short', 'medium', 'long')),
  strategy text not null check (strategy in ('CONSERVATIVE', 'BALANCED', 'AGGRESSIVE')),
  portfolio_score smallint check (portfolio_score is null or portfolio_score between 0 and 100),
  confidence text not null check (confidence in ('HIGH', 'MEDIUM', 'LOW', 'INSUFFICIENT')),
  settings jsonb not null default '{}'::jsonb,
  reasons jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.investment_portfolio_positions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  portfolio_id uuid not null,
  product_id uuid,
  set_id uuid,
  listing_id uuid,
  product_name text not null check (char_length(trim(product_name)) between 1 and 300),
  set_name text not null check (char_length(trim(set_name)) between 1 and 200),
  store_name text not null check (char_length(trim(store_name)) between 1 and 200),
  tcg text not null check (tcg in ('pokemon', 'one_piece', 'lorcana')),
  language text not null check (char_length(trim(language)) between 1 and 20),
  product_type text not null check (char_length(trim(product_type)) between 1 and 100),
  horizon text not null check (horizon in ('short', 'medium', 'long')),
  quantity integer not null check (quantity > 0),
  unit_cost_cents integer not null check (unit_cost_cents >= 0),
  total_cost_cents integer not null check (total_cost_cents = unit_cost_cents * quantity),
  product_score smallint not null check (product_score between 0 and 100),
  set_score smallint check (set_score is null or set_score between 0 and 100),
  vehicle_score smallint not null check (vehicle_score between 0 and 100),
  entry_score smallint check (entry_score is null or entry_score between 0 and 100),
  entry_confidence text not null check (entry_confidence in ('HIGH', 'MEDIUM', 'LOW', 'INSUFFICIENT')),
  market_reference_cents integer check (market_reference_cents is null or market_reference_cents > 0),
  deal_classification text check (deal_classification is null or deal_classification in ('CHOLLO', 'OPPORTUNITY', 'GOOD_PRICE', 'NORMAL', 'EXPENSIVE')),
  shipping_known boolean not null,
  stock_status text not null check (stock_status in ('in_stock', 'preorder')),
  country text not null check (country ~ '^[A-Z]{2}$'),
  product_url text not null check (char_length(product_url) between 1 and 2048),
  created_at timestamptz not null default now(),
  foreign key (portfolio_id, user_id) references public.investment_portfolios(id, user_id) on delete cascade,
  foreign key (product_id, user_id) references public.products(id, user_id) on delete set null (product_id),
  foreign key (set_id, user_id) references public.tcg_sets(id, user_id) on delete set null (set_id),
  foreign key (listing_id, user_id) references public.listings(id, user_id) on delete set null (listing_id)
);

create index investment_portfolios_user_created_idx
  on public.investment_portfolios(user_id, created_at desc);

create index investment_portfolio_positions_portfolio_idx
  on public.investment_portfolio_positions(user_id, portfolio_id);

alter table public.investment_portfolios enable row level security;
alter table public.investment_portfolio_positions enable row level security;

create policy "Users manage own investment portfolios"
  on public.investment_portfolios for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users manage own investment portfolio positions"
  on public.investment_portfolio_positions for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

commit;
