import type { PullRateCategoryGroup, PullRateSourceType } from "./types";

export type NormalizedPullRateRecord = {
  externalCardId: string | null;
  cardNumber: string | null;
  variantName: string | null;
  category: string;
  categoryGroup: PullRateCategoryGroup;
  subcategory: string | null;
  oddsNumerator: number | null;
  oddsDenominator: number | null;
  probabilityPpm: number;
  sampleSize: number | null;
  source: string;
  sourceType: PullRateSourceType;
  reportedConfidence: "HIGH" | "MEDIUM" | "LOW" | null;
  sourceNote: string | null;
  outcomeGroup: string | null;
  mutuallyExclusive: boolean;
  observedAt: string | null;
  sourceMetadata: Record<string, string | number | boolean | null>;
};

export interface PullRateProvider {
  readonly sourceKey: string;
  load(setId: string): Promise<NormalizedPullRateRecord[]>;
}
