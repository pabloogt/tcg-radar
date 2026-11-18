begin;

create table public.product_investment_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null,
  vehicle_score_override smallint check (vehicle_score_override is null or vehicle_score_override between 0 and 100),
  exclusive boolean not null default false,
  limited_distribution boolean not null default false,
  special_promo_score smallint check (special_promo_score is null or special_promo_score between 0 and 100),
  storage_efficiency_score smallint check (storage_efficiency_score is null or storage_efficiency_score between 0 and 100),
  liquidity_score smallint check (liquidity_score is null or liquidity_score between 0 and 100),
  sealed_collectability_score smallint check (sealed_collectability_score is null or sealed_collectability_score between 0 and 100),
  notes text check (notes is null or char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, user_id),
  foreign key (product_id, user_id) references public.products(id, user_id) on delete cascade
);

create table public.product_investment_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null,
  short_score smallint check (short_score is null or short_score between 0 and 100),
  medium_score smallint check (medium_score is null or medium_score between 0 and 100),
  long_score smallint check (long_score is null or long_score between 0 and 100),
  set_short_score smallint check (set_short_score is null or set_short_score between 0 and 100),
  set_medium_score smallint check (set_medium_score is null or set_medium_score between 0 and 100),
  set_long_score smallint check (set_long_score is null or set_long_score between 0 and 100),
  vehicle_score smallint not null check (vehicle_score between 0 and 100),
  entry_score smallint check (entry_score is null or entry_score between 0 and 100),
  entry_confidence text not null check (entry_confidence in ('HIGH', 'MEDIUM', 'LOW', 'INSUFFICIENT')),
  entry_completeness smallint not null check (entry_completeness between 0 and 100),
  best_listing_price_cents integer check (best_listing_price_cents is null or best_listing_price_cents >= 0),
  market_reference_cents integer check (market_reference_cents is null or market_reference_cents > 0),
  comparison_basis text check (comparison_basis is null or comparison_basis in ('BASE_PRICE', 'TOTAL_ACQUISITION')),
  calculation_fingerprint text not null check (char_length(calculation_fingerprint) between 1 and 500),
  created_at timestamptz not null default now(),
  foreign key (product_id, user_id) references public.products(id, user_id) on delete cascade
);

create index product_investment_profiles_user_product_idx on public.product_investment_profiles(user_id, product_id);
create index product_investment_snapshots_product_created_idx on public.product_investment_snapshots(user_id, product_id, created_at desc);

create trigger product_investment_profiles_set_updated_at
  before update on public.product_investment_profiles
  for each row execute function public.set_updated_at();

alter table public.product_investment_profiles enable row level security;
alter table public.product_investment_snapshots enable row level security;

create policy "Users manage own product investment profiles"
  on public.product_investment_profiles for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users manage own product investment snapshots"
  on public.product_investment_snapshots for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

commit;
