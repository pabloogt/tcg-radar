begin;

create table public.tcg_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  set_id uuid not null,
  tcg text not null check (tcg in ('pokemon', 'one_piece', 'lorcana')),
  name text not null check (char_length(trim(name)) between 1 and 300),
  card_number text not null check (char_length(trim(card_number)) between 1 and 80),
  rarity text not null check (char_length(trim(rarity)) between 1 and 120),
  rarity_group text check (rarity_group is null or rarity_group in ('common', 'uncommon', 'rare', 'ultra', 'special', 'secret', 'promo', 'other')),
  normalized_key text not null check (char_length(normalized_key) between 1 and 500),
  image_url text check (image_url is null or char_length(image_url) <= 2048),
  character_name text check (character_name is null or char_length(trim(character_name)) between 1 and 200),
  variant_name text check (variant_name is null or char_length(trim(variant_name)) between 1 and 200),
  external_ids jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, set_id, normalized_key, card_number),
  foreign key (set_id, user_id) references public.tcg_sets(id, user_id) on delete cascade
);

create table public.card_price_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid not null,
  source text not null check (char_length(trim(source)) between 1 and 100),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  market_price_cents integer check (market_price_cents is null or market_price_cents >= 0),
  low_price_cents integer check (low_price_cents is null or low_price_cents >= 0),
  trend_price_cents integer check (trend_price_cents is null or trend_price_cents >= 0),
  observed_at timestamptz not null,
  observation_key text not null check (char_length(observation_key) between 1 and 500),
  source_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (market_price_cents is not null or low_price_cents is not null or trend_price_cents is not null),
  unique (user_id, card_id, source, observation_key),
  foreign key (card_id, user_id) references public.tcg_cards(id, user_id) on delete cascade
);

create index tcg_cards_user_set_idx on public.tcg_cards(user_id, set_id);
create index tcg_cards_external_ids_idx on public.tcg_cards using gin(external_ids);
create index card_price_history_card_observed_idx on public.card_price_history(user_id, card_id, observed_at desc);

create trigger tcg_cards_set_updated_at
  before update on public.tcg_cards
  for each row execute function public.set_updated_at();

alter table public.tcg_cards enable row level security;
alter table public.card_price_history enable row level security;

create policy "Users manage own tcg cards"
  on public.tcg_cards for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users manage own card price history"
  on public.card_price_history for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

commit;
