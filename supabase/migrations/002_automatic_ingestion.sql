begin;

alter table public.stores add column source_key text;
alter table public.stores add column normalized_domain text;
alter table public.products add column normalized_key text;
alter table public.listings add column source_key text;
alter table public.listings add column source_product_id text;
alter table public.listings add column canonical_url text;
alter table public.alerts add column dedupe_key text;

alter table public.alerts drop constraint if exists alerts_alert_type_check;
alter table public.alerts add constraint alerts_alert_type_check
  check (alert_type in ('price_drop', 'back_in_stock', 'target_price', 'financial_opportunity', 'manual'));

create unique index stores_user_source_key_uidx on public.stores(user_id, source_key) where source_key is not null;
create unique index stores_user_domain_uidx on public.stores(user_id, normalized_domain) where normalized_domain is not null;
create unique index products_user_normalized_key_uidx on public.products(user_id, normalized_key) where normalized_key is not null;
create unique index listings_user_source_product_uidx on public.listings(user_id, source_key, source_product_id) where source_key is not null and source_product_id is not null;
create unique index listings_user_store_url_uidx on public.listings(user_id, store_id, canonical_url) where canonical_url is not null;
create unique index alerts_user_dedupe_key_uidx on public.alerts(user_id, dedupe_key) where dedupe_key is not null;

commit;
