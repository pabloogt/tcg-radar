begin;

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
      'manual'
    )
  );

commit;
