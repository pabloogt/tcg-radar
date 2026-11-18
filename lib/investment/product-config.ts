import type { InvestmentHorizon } from "./config";

export const DEFAULT_PRODUCT_VEHICLE_SCORES: Readonly<Record<string, number>> = {
  booster_box: 92,
  pokemon_center_etb: 90,
  sealed_case: 88,
  elite_trainer_box: 82,
  booster_bundle: 78,
  ultra_premium_collection: 78,
  premium_collection: 70,
  collection_box: 65,
  build_and_battle: 67,
  battle_box: 65,
  battle_deck: 60,
  starter_deck: 60,
  sleeved_booster: 62,
  blister_pack: 60,
  tin: 58,
  booster_pack: 50,
  other_sealed: 50,
};

export const SUPPORTED_PRODUCT_INVESTMENT_TYPES = new Set(Object.keys(DEFAULT_PRODUCT_VEHICLE_SCORES));

export const TCG_PRODUCT_VEHICLE_OVERRIDES: Readonly<Record<string, Readonly<Record<string, number>>>> = {};

export const PRODUCT_VEHICLE_MODIFIERS = {
  exclusive: 4,
  limitedDistribution: 4,
  specialPromo: 0.12,
  storageEfficiency: 0.12,
  liquidity: 0.15,
  sealedCollectability: 0.18,
} as const;

export const ENTRY_COMPONENT_WEIGHTS = {
  marketReference: 40,
  thirtyDayTypical: 20,
  thirtyDayLow: 15,
  msrp: 15,
  momentum: 10,
} as const;

export const PRODUCT_INVESTMENT_WEIGHTS: Readonly<Record<InvestmentHorizon, { set: number; vehicle: number; entry: number }>> = {
  short: { set: 35, vehicle: 20, entry: 45 },
  medium: { set: 45, vehicle: 25, entry: 30 },
  long: { set: 55, vehicle: 30, entry: 15 },
};
