begin;

create table public.monitor_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_key text not null check (char_length(trim(source_key)) between 1 and 100),
  trigger_type text not null check (trigger_type in ('manual', 'scheduled')),
  status text not null check (status in ('running', 'completed', 'failed', 'partial')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  products_seen integer not null default 0 check (products_seen >= 0),
  observations integer not null default 0 check (observations >= 0),
  products_created integer not null default 0 check (products_created >= 0),
  products_matched integer not null default 0 check (products_matched >= 0),
  listings_created integer not null default 0 check (listings_created >= 0),
  listings_updated integer not null default 0 check (listings_updated >= 0),
  price_histories_created integer not null default 0 check (price_histories_created >= 0),
  alert_candidates integer not null default 0 check (alert_candidates >= 0),
  alerts_sent integer not null default 0 check (alerts_sent >= 0),
  alerts_suppressed integer not null default 0 check (alerts_suppressed >= 0),
  alerts_failed integer not null default 0 check (alerts_failed >= 0),
  errors_count integer not null default 0 check (errors_count >= 0),
  safe_error_summary text check (safe_error_summary is null or char_length(safe_error_summary) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'running' and finished_at is null)
    or (status in ('completed', 'failed', 'partial') and finished_at is not null)
  )
);

create unique index monitor_runs_active_source_uidx
  on public.monitor_runs(user_id, source_key)
  where status = 'running';

create index monitor_runs_user_source_started_idx
  on public.monitor_runs(user_id, source_key, started_at desc);

create trigger monitor_runs_set_updated_at
  before update on public.monitor_runs
  for each row execute function public.set_updated_at();

alter table public.monitor_runs enable row level security;

create policy "Users view own monitor runs"
  on public.monitor_runs
  for select
  using ((select auth.uid()) = user_id);

commit;
