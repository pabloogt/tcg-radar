begin;

create table public.set_market_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  set_id uuid not null,
  signal_type text not null check (
    signal_type in (
      'stock_availability',
      'stock_decline',
      'restock_frequency',
      'sellout_speed',
      'sealed_price_momentum',
      'store_coverage',
      'demand_score',
      'manual_demand',
      'hype_score',
      'manual_hype',
      'external_hype',
      'reprint_event',
      'reprint_risk',
      'manual_reprint_risk',
      'official_reprint_announced',
      'official_restock_announced',
      'large_supply_return',
      'new_wave_detected',
      'availability_expansion',
      'availability_contraction',
      'distributor_signal',
      'set_out_of_print',
      'production_window_closed',
      'unknown_supply_status'
    )
  ),
  source_type text not null check (source_type in ('internal', 'manual', 'official', 'external', 'derived')),
  source_key text check (source_key is null or char_length(trim(source_key)) between 1 and 120),
  value smallint not null check (value between 0 and 100),
  confidence text not null check (confidence in ('HIGH', 'MEDIUM', 'LOW')),
  observed_at timestamptz not null default now(),
  sample_size integer check (sample_size is null or sample_size >= 0),
  metadata jsonb not null default '{}'::jsonb,
  note text check (note is null or char_length(note) <= 1000),
  reprint_status text check (
    reprint_status is null
    or reprint_status in ('LOW_RISK', 'MODERATE_RISK', 'HIGH_RISK', 'CONFIRMED_REPRINT', 'UNKNOWN')
  ),
  confirmed_reprint boolean not null default false,
  announcement_date date,
  expected_supply_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (set_id, user_id) references public.tcg_sets(id, user_id) on delete cascade,
  check (
    not confirmed_reprint
    or signal_type in ('reprint_event', 'manual_reprint_risk', 'official_reprint_announced')
  ),
  check (not confirmed_reprint or reprint_status is null or reprint_status = 'CONFIRMED_REPRINT'),
  check (signal_type <> 'official_reprint_announced' or confirmed_reprint),
  check (signal_type not in ('manual_demand', 'manual_hype', 'manual_reprint_risk') or source_type = 'manual'),
  check (signal_type not in ('official_reprint_announced', 'official_restock_announced') or source_type = 'official'),
  check (
    signal_type in (
      'reprint_event', 'reprint_risk', 'manual_reprint_risk', 'official_reprint_announced',
      'official_restock_announced', 'large_supply_return', 'new_wave_detected',
      'availability_expansion', 'distributor_signal', 'set_out_of_print',
      'production_window_closed', 'unknown_supply_status'
    )
    or (
      reprint_status is null
      and not confirmed_reprint
      and announcement_date is null
      and expected_supply_date is null
    )
  ),
  check (
    reprint_status is null
    or reprint_status = 'UNKNOWN'
    or (reprint_status = 'LOW_RISK' and value < 40)
    or (reprint_status = 'MODERATE_RISK' and value between 40 and 69)
    or (reprint_status = 'HIGH_RISK' and value >= 70)
    or (reprint_status = 'CONFIRMED_REPRINT' and confirmed_reprint)
  )
);

create index set_market_signals_user_set_idx
  on public.set_market_signals(user_id, set_id, observed_at desc);

create index set_market_signals_type_observed_idx
  on public.set_market_signals(user_id, signal_type, observed_at desc);

create trigger set_market_signals_set_updated_at
  before update on public.set_market_signals
  for each row execute function public.set_updated_at();

alter table public.set_market_signals enable row level security;

create policy "Users manage own set market signals"
  on public.set_market_signals for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

commit;
