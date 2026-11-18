begin;

create table public.tcg_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tcg text not null check (tcg in ('pokemon', 'one_piece', 'lorcana')),
  name text not null check (char_length(trim(name)) between 1 and 200),
  normalized_key text not null check (char_length(normalized_key) between 1 and 220),
  release_date date,
  image_url text check (image_url is null or char_length(image_url) <= 2048),
  series text check (series is null or char_length(trim(series)) between 1 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, tcg, normalized_key)
);

alter table public.products add column set_id uuid;
alter table public.products add constraint products_set_owner_fk
  foreign key (set_id, user_id) references public.tcg_sets(id, user_id)
  on delete set null (set_id);

create table public.set_investment_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  set_id uuid not null,
  chase_strength smallint check (chase_strength between 0 and 100),
  chase_depth smallint check (chase_depth between 0 and 100),
  card_value smallint check (card_value between 0 and 100),
  pull_rate_attractiveness smallint check (pull_rate_attractiveness between 0 and 100),
  character_strength smallint check (character_strength between 0 and 100),
  collector_appeal smallint check (collector_appeal between 0 and 100),
  demand smallint check (demand between 0 and 100),
  hype smallint check (hype between 0 and 100),
  scarcity smallint check (scarcity between 0 and 100),
  reprint_safety smallint check (reprint_safety between 0 and 100),
  price_momentum smallint check (price_momentum between 0 and 100),
  set_maturity smallint check (set_maturity between 0 and 100),
  top_card_price_cents integer check (top_card_price_cents is null or top_card_price_cents >= 0),
  top3_cards_value_cents integer check (top3_cards_value_cents is null or top3_cards_value_cents >= 0),
  top5_cards_value_cents integer check (top5_cards_value_cents is null or top5_cards_value_cents >= 0),
  top10_cards_value_cents integer check (top10_cards_value_cents is null or top10_cards_value_cents >= 0),
  cards_over_20_eur integer check (cards_over_20_eur is null or cards_over_20_eur >= 0),
  cards_over_50_eur integer check (cards_over_50_eur is null or cards_over_50_eur >= 0),
  cards_over_100_eur integer check (cards_over_100_eur is null or cards_over_100_eur >= 0),
  estimated_hit_rate_bps integer check (estimated_hit_rate_bps is null or estimated_hit_rate_bps between 0 and 10000),
  estimated_top_hit_rate_bps integer check (estimated_top_hit_rate_bps is null or estimated_top_hit_rate_bps between 0 and 10000),
  stores_in_stock integer check (stores_in_stock is null or stores_in_stock >= 0),
  stock_decline_30d_bps integer check (stock_decline_30d_bps is null or stock_decline_30d_bps between -10000 and 10000),
  sealed_price_30d_change_bps integer check (sealed_price_30d_change_bps is null or sealed_price_30d_change_bps between -10000 and 10000),
  card_market_30d_change_bps integer check (card_market_30d_change_bps is null or card_market_30d_change_bps between -10000 and 10000),
  metric_provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (set_id, user_id),
  foreign key (set_id, user_id) references public.tcg_sets(id, user_id) on delete cascade
);

create table public.set_investment_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  set_id uuid not null,
  metrics jsonb not null,
  short_score smallint check (short_score is null or short_score between 0 and 100),
  medium_score smallint check (medium_score is null or medium_score between 0 and 100),
  long_score smallint check (long_score is null or long_score between 0 and 100),
  data_completeness smallint not null check (data_completeness between 0 and 100),
  confidence text not null check (confidence in ('HIGH', 'MEDIUM', 'LOW', 'INSUFFICIENT')),
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (set_id, user_id) references public.tcg_sets(id, user_id) on delete cascade
);

create index products_user_set_idx on public.products(user_id, set_id);
create index tcg_sets_user_tcg_idx on public.tcg_sets(user_id, tcg, name);
create index set_investment_snapshots_set_observed_idx on public.set_investment_snapshots(user_id, set_id, observed_at desc);

create trigger tcg_sets_set_updated_at before update on public.tcg_sets for each row execute function public.set_updated_at();
create trigger set_investment_metrics_set_updated_at before update on public.set_investment_metrics for each row execute function public.set_updated_at();

alter table public.tcg_sets enable row level security;
alter table public.set_investment_metrics enable row level security;
alter table public.set_investment_snapshots enable row level security;

create policy "Users manage own tcg sets" on public.tcg_sets for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users manage own set investment metrics" on public.set_investment_metrics for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users manage own set investment snapshots" on public.set_investment_snapshots for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

commit;
