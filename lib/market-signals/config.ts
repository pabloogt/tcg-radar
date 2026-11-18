import type { MarketSignalConfidence, MarketSignalSourceType } from "./types";

export const DAY_MS = 86_400_000;

export const demandComponentWeights = {
  selloutSpeed: 30,
  availabilityContraction: 25,
  restockActivity: 20,
  sealedPriceMomentum: 10,
  inStockPressure: 15,
} as const;

export const hypeSourceWeights: Record<MarketSignalSourceType, number> = {
  official: 115,
  manual: 100,
  external: 100,
  derived: 80,
  internal: 60,
};

// Provider keys are optional. Future integrations can inject calibrated weights
// without coupling the domain model to Google, Reddit, YouTube, or any vendor.
export const defaultHypeProviderWeights: Readonly<Record<string, number>> = {};

export const confidenceWeights: Record<Exclude<MarketSignalConfidence, "INSUFFICIENT">, number> = {
  HIGH: 100,
  MEDIUM: 70,
  LOW: 40,
};

export const HYPE_HALF_LIFE_DAYS = 45;
export const MARKET_SIGNAL_CHANGE_THRESHOLD = 3;

export const reprintComponentWeights = {
  explicitSignals: 40,
  availabilityExpansion: 20,
  simultaneousRestocks: 15,
  sealedPricePressure: 10,
  setLifecycle: 10,
  supplyTrend: 5,
} as const;
