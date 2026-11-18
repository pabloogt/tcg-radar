import type { EntryConfidence } from "./entry-price";

export type PortfolioStrategy = "CONSERVATIVE" | "BALANCED" | "AGGRESSIVE";

export type PortfolioStrategyDefaults = {
  minimumScore: number;
  minimumEntryScore: number;
  minimumEntryConfidence: Exclude<EntryConfidence, "INSUFFICIENT">;
  maxProductBps: number;
  maxSetBps: number;
  maxTcgBps: number;
  maxUnitsPerProduct: number;
  maxDistinctProducts: number;
};

export const PORTFOLIO_STRATEGY_DEFAULTS: Readonly<Record<PortfolioStrategy, PortfolioStrategyDefaults>> = {
  CONSERVATIVE: {
    minimumScore: 75,
    minimumEntryScore: 50,
    minimumEntryConfidence: "MEDIUM",
    maxProductBps: 2_500,
    maxSetBps: 4_500,
    maxTcgBps: 6_500,
    maxUnitsPerProduct: 3,
    maxDistinctProducts: 6,
  },
  BALANCED: {
    minimumScore: 70,
    minimumEntryScore: 40,
    minimumEntryConfidence: "MEDIUM",
    maxProductBps: 3_500,
    maxSetBps: 5_500,
    maxTcgBps: 7_500,
    maxUnitsPerProduct: 3,
    maxDistinctProducts: 6,
  },
  AGGRESSIVE: {
    minimumScore: 65,
    minimumEntryScore: 30,
    minimumEntryConfidence: "LOW",
    maxProductBps: 5_000,
    maxSetBps: 7_000,
    maxTcgBps: 9_000,
    maxUnitsPerProduct: 3,
    maxDistinctProducts: 6,
  },
};

export const PORTFOLIO_LIMITS = {
  minimumBudgetCents: 1_000,
  maximumBudgetCents: 10_000_000,
  staleListingHours: 24,
  minimumValidUnitCostCents: 100,
  maximumDistinctProducts: 20,
  maximumUnitsPerProduct: 20,
} as const;

export const PORTFOLIO_CONFIDENCE_RANK: Readonly<Record<EntryConfidence, number>> = {
  INSUFFICIENT: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
};
