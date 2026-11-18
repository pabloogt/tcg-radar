begin;

create table public.deal_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  good_price_bps integer not null default 0,
  opportunity_bps integer not null default 800,
  bargain_bps integer not null default 1500,
  expensive_bps integer not null default 1000,
  alert_bargains boolean not null default true,
  alert_opportunities boolean not null default true,
  alert_good_prices boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (good_price_bps between 0 and 5000),
  check (opportunity_bps between 1 and 10000),
  check (bargain_bps between 2 and 10000),
  check (expensive_bps between 1 and 10000),
  check (good_price_bps < opportunity_bps and opportunity_bps < bargain_bps)
);

create table public.market_reference_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null,
  source text not null check (source in ('internal_market', 'external_market', 'manual', 'combined')),
  reference_price_cents integer not null check (reference_price_cents > 0),
  comparison_basis text not null check (comparison_basis in ('BASE_PRICE', 'TOTAL_ACQUISITION')),
  confidence text not null check (confidence in ('HIGH', 'MEDIUM', 'LOW')),
  observed_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (product_id, user_id) references public.products(id, user_id) on delete cascade
);

create index market_reference_snapshots_product_observed_idx
  on public.market_reference_snapshots(user_id, product_id, observed_at desc);

create trigger deal_settings_set_updated_at
  before update on public.deal_settings
  for each row execute function public.set_updated_at();

alter table public.deal_settings enable row level security;
alter table public.market_reference_snapshots enable row level security;

create policy "Users manage own deal settings"
  on public.deal_settings for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users view own market reference snapshots"
  on public.market_reference_snapshots for select
  using ((select auth.uid()) = user_id);

create policy "Users create own market reference snapshots"
  on public.market_reference_snapshots for insert
  with check ((select auth.uid()) = user_id);

alter table public.alerts
  drop constraint if exists alerts_alert_type_check;

alter table public.alerts
  add constraint alerts_alert_type_check
  check (
    alert_type in (
      'new_product',
      'price_drop',
      'back_in_stock',
      'target_price',
      'financial_opportunity',
      'new_price_low',
      'deal_good_price',
      'deal_opportunity',
      'deal_bargain',
      'manual'
    )
  );

commit;
