begin;

alter table public.listings
  add column shipping_known boolean not null default true;

commit;
