begin;

alter table public.price_history
  add column shipping_cents integer,
  add column shipping_known boolean not null default false;

alter table public.price_history
  add constraint price_history_shipping_cents_nonnegative
  check (shipping_cents is null or shipping_cents >= 0),
  add constraint price_history_shipping_consistency
  check (
    (shipping_known = true and shipping_cents is not null)
    or (shipping_known = false and shipping_cents is null)
  );

comment on column public.price_history.shipping_known is
  'Whether shipping_cents was known at the time of this observation. Existing rows remain safely unknown.';

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
      'manual'
    )
  );

commit;
