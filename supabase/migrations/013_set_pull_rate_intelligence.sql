begin;

alter table public.tcg_sets
  add column packs_per_booster_box smallint check (packs_per_booster_box is null or packs_per_booster_box between 1 and 1000),
  add column cards_per_pack smallint check (cards_per_pack is null or cards_per_pack between 1 and 1000);

alter table public.tcg_cards
  add constraint tcg_cards_id_user_set_key unique (id, user_id, set_id);

create table public.set_pull_rates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  set_id uuid not null,
  card_id uuid,
  category text not null check (char_length(trim(category)) between 1 and 160),
  category_group text not null check (category_group in ('ANY_HIT', 'HIGH_RARITY_HIT', 'CHASE_TIER', 'TOP_CHASE', 'SPECIFIC_CARD', 'SPECIAL_SLOT', 'BOX_HIT', 'OTHER')),
  subcategory text check (subcategory is null or char_length(trim(subcategory)) between 1 and 160),
  odds_numerator integer check (odds_numerator is null or odds_numerator > 0),
  odds_denominator integer check (odds_denominator is null or odds_denominator > 0),
  probability_ppm integer not null check (probability_ppm between 1 and 1000000),
  sample_size integer check (sample_size is null or sample_size >= 0),
  source text not null check (char_length(trim(source)) between 1 and 120),
  source_type text not null check (source_type in ('official', 'community', 'manual', 'derived', 'external')),
  confidence text check (confidence is null or confidence in ('HIGH', 'MEDIUM', 'LOW')),
  source_note text check (source_note is null or char_length(source_note) <= 1000),
  outcome_group text check (outcome_group is null or char_length(trim(outcome_group)) between 1 and 120),
  mutually_exclusive boolean not null default false,
  observed_at timestamptz,
  observation_key text not null check (char_length(observation_key) between 1 and 500),
  source_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((odds_numerator is null) = (odds_denominator is null)),
  check (odds_numerator is null or odds_numerator <= odds_denominator),
  unique (user_id, set_id, source, observation_key),
  foreign key (set_id, user_id) references public.tcg_sets(id, user_id) on delete cascade,
  foreign key (card_id, user_id, set_id) references public.tcg_cards(id, user_id, set_id) on delete cascade
);

create index set_pull_rates_user_set_idx on public.set_pull_rates(user_id, set_id);
create index set_pull_rates_set_category_idx on public.set_pull_rates(set_id, category_group, category);
create index set_pull_rates_card_idx on public.set_pull_rates(card_id) where card_id is not null;
create index set_pull_rates_source_observed_idx on public.set_pull_rates(user_id, source, observed_at desc);

create trigger set_pull_rates_set_updated_at
  before update on public.set_pull_rates
  for each row execute function public.set_updated_at();

alter table public.set_pull_rates enable row level security;

create policy "Users manage own set pull rates"
  on public.set_pull_rates for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

commit;
