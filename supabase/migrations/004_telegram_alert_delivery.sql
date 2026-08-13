begin;

create table public.listing_alert_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid not null,
  target_price_cents integer not null check (target_price_cents >= 0),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (listing_id, user_id),
  foreign key (listing_id, user_id) references public.listings(id, user_id) on delete cascade
);

alter table public.alerts
  add column delivery_status text not null default 'pending'
    check (delivery_status in ('pending', 'sending', 'delivered', 'failed', 'suppressed')),
  add column delivery_attempts smallint not null default 0
    check (delivery_attempts between 0 and 3),
  add column last_attempt_at timestamptz;

-- Candidates created by earlier versions were never sent. Suppress them so enabling
-- Telegram cannot replay historical changes.
update public.alerts
set
  delivery_status = case when delivered then 'delivered' else 'suppressed' end,
  error_message = null;

alter table public.alerts
  add constraint alerts_delivery_state_consistency_check
  check (
    (
      delivery_status = 'delivered'
      and delivered
      and delivered_at is not null
      and error_message is null
    )
    or (
      delivery_status = 'failed'
      and not delivered
      and delivered_at is null
      and error_message is not null
      and delivery_attempts >= 1
      and last_attempt_at is not null
    )
    or (
      delivery_status = 'sending'
      and not delivered
      and delivered_at is null
      and error_message is null
      and delivery_attempts >= 1
      and last_attempt_at is not null
    )
    or (
      delivery_status in ('pending', 'suppressed')
      and not delivered
      and delivered_at is null
      and error_message is null
    )
  );

create index listing_alert_targets_user_idx
  on public.listing_alert_targets(user_id, enabled);

create index alerts_user_delivery_status_idx
  on public.alerts(user_id, delivery_status, created_at desc);

create trigger listing_alert_targets_set_updated_at
  before update on public.listing_alert_targets
  for each row execute function public.set_updated_at();

alter table public.listing_alert_targets enable row level security;

create policy "Users manage own listing alert targets"
  on public.listing_alert_targets
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

commit;
