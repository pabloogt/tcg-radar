export type PullRateCategoryGroup = "ANY_HIT" | "HIGH_RARITY_HIT" | "CHASE_TIER" | "TOP_CHASE" | "SPECIFIC_CARD" | "SPECIAL_SLOT" | "BOX_HIT" | "OTHER";
export type PullRateSourceType = "official" | "community" | "manual" | "derived" | "external";
export type PullRateConfidence = "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT";
export type PullDataState = "PRELIMINARY" | "ESTABLISHED";
export type PullRateWarning = "low_sample_size" | "conflicting_sources" | "stale_data" | "incomplete_tiers" | "probability_inconsistency" | "missing_card_prices" | "high_jackpot_dependency";

export type PullRateObservation = {
  id: string;
  setId: string;
  cardId: string | null;
  category: string;
  categoryGroup: PullRateCategoryGroup;
  subcategory: string | null;
  oddsNumerator: number | null;
  oddsDenominator: number | null;
  probabilityPpm: number;
  sampleSize: number | null;
  source: string;
  sourceType: PullRateSourceType;
  reportedConfidence: Exclude<PullRateConfidence, "INSUFFICIENT"> | null;
  sourceNote: string | null;
  outcomeGroup: string | null;
  mutuallyExclusive: boolean;
  observedAt: string | null;
};

export type AggregatedPullRate = {
  identity: string;
  category: string;
  categoryGroup: PullRateCategoryGroup;
  subcategory: string | null;
  cardId: string | null;
  probabilityPpm: number;
  packsPerHitMilli: number;
  sampleSize: number | null;
  sources: string[];
  confidence: PullRateConfidence;
  sourceConflict: boolean;
  observedAt: string | null;
};

export type PullRateCrossSignals = {
  chaseStrength: number | null;
  chaseDepth: number | null;
  cardValue: number | null;
  chaseConcentration: number | null;
};

export type SetPullRateAnalytics = {
  setId: string;
  tcg: string;
  rates: AggregatedPullRate[];
  overallHitRatePpm: number | null;
  highRarityHitRatePpm: number | null;
  topTierHitRatePpm: number | null;
  specificTopChaseRatePpm: number | null;
  averagePacksPerHitMilli: number | null;
  averagePacksPerHighRarityMilli: number | null;
  averagePacksPerTopTierMilli: number | null;
  expectedHitsPerBoxMilli: number | null;
  expectedHighRarityHitsPerBoxMilli: number | null;
  expectedTopTierHitsPerBoxMilli: number | null;
  expectedTopChaseHitsPerBoxMilli: number | null;
  packsPerBoosterBox: number | null;
  hitFrequencyScore: number | null;
  topChaseDifficulty: number | null;
  pullRateAttractiveness: number | null;
  openingDemandPotential: number | null;
  pullDataCompleteness: number;
  confidence: PullRateConfidence;
  dataState: PullDataState;
  totalSampleSize: number | null;
  warnings: PullRateWarning[];
};
