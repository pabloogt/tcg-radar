import { calculateMedian, type ComparisonBasis, type MarketReferenceConfidence } from "@/lib/market/reference";
import { ENTRY_COMPONENT_WEIGHTS } from "./product-config";

export type EntryConfidence = "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT";
export type EntryComponentKey = keyof typeof ENTRY_COMPONENT_WEIGHTS;
export type EntryPriceComponents = Record<EntryComponentKey, number | null>;

export type EntryPriceInput = {
  productPriceCents: number;
  comparablePriceCents: number;
  comparisonBasis: Exclude<ComparisonBasis, "INCOMPLETE">;
  shippingKnown: boolean;
  stockStatus: string;
  marketReference: { priceCents: number; comparisonBasis: Exclude<ComparisonBasis, "INCOMPLETE">; confidence: Exclude<MarketReferenceConfidence, "INSUFFICIENT"> } | null;
  thirtyDayComparablePrices: readonly number[];
  retailPriceCents: number | null;
  momentumScore: number | null;
};

export type EntryPriceResult = {
  score: number | null;
  completeness: number;
  confidence: EntryConfidence;
  comparisonBasis: Exclude<ComparisonBasis, "INCOMPLETE">;
  components: EntryPriceComponents;
  thirtyDayMedianCents: number | null;
  thirtyDayLowCents: number | null;
  marketReferenceCents: number | null;
};

export type InvestmentListingCandidate = { id: string; priceCents: number; shippingCents: number | null; shippingKnown: boolean; stockStatus: string };

export function selectBestPurchasableListing<T extends InvestmentListingCandidate>(listings: readonly T[]): T | null {
  const inStock = listings.filter((listing) => listing.stockStatus === "in_stock");
  const preorder = listings.filter((listing) => listing.stockStatus === "preorder");
  const candidates = inStock.length > 0 ? inStock : preorder;
  const confirmed = candidates.filter((listing) => listing.shippingKnown && listing.shippingCents !== null);
  if (confirmed.length > 0) return [...confirmed].sort((left, right) => left.priceCents + left.shippingCents! - right.priceCents - right.shippingCents! || left.id.localeCompare(right.id))[0];
  return [...candidates].sort((left, right) => left.priceCents - right.priceCents || left.id.localeCompare(right.id))[0] ?? null;
}

type Anchor = readonly [basisPoints: number, score: number];

function interpolate(value: number, anchors: readonly Anchor[]): number {
  if (value <= anchors[0][0]) return anchors[0][1];
  if (value >= anchors[anchors.length - 1][0]) return anchors[anchors.length - 1][1];
  for (let index = 1; index < anchors.length; index += 1) {
    const right = anchors[index];
    const left = anchors[index - 1];
    if (value <= right[0]) return Math.round(left[1] + ((value - left[0]) * (right[1] - left[1])) / (right[0] - left[0]));
  }
  return anchors[anchors.length - 1][1];
}

function relativeDiscountBps(candidateCents: number, referenceCents: number): number | null {
  if (!Number.isInteger(candidateCents) || candidateCents < 0 || !Number.isInteger(referenceCents) || referenceCents <= 0) return null;
  return Math.round(((referenceCents - candidateCents) * 10_000) / referenceCents);
}

export function calculatePriceVsMarketScore(candidateCents: number, referenceCents: number): number | null {
  const difference = relativeDiscountBps(candidateCents, referenceCents);
  return difference === null ? null : interpolate(difference, [[-2_000, 10], [-1_000, 35], [-500, 52], [0, 68], [500, 76], [1_000, 84], [1_500, 92], [2_000, 100]]);
}

export function calculatePriceVsHistoryScore(candidateCents: number, medianCents: number): number | null {
  const difference = relativeDiscountBps(candidateCents, medianCents);
  return difference === null ? null : interpolate(difference, [[-2_000, 5], [-1_000, 30], [0, 65], [1_000, 85], [2_000, 100]]);
}

export function calculateDistanceFromLowScore(candidateCents: number, lowCents: number): number | null {
  if (!Number.isInteger(candidateCents) || candidateCents < 0 || !Number.isInteger(lowCents) || lowCents <= 0) return null;
  const premiumBps = Math.round(((candidateCents - lowCents) * 10_000) / lowCents);
  return interpolate(premiumBps, [[0, 100], [300, 92], [500, 85], [1_000, 70], [2_000, 50], [5_000, 10]]);
}

export function calculateMsrpEntryScore(productPriceCents: number, retailPriceCents: number): number | null {
  const difference = relativeDiscountBps(productPriceCents, retailPriceCents);
  return difference === null ? null : interpolate(difference, [[-5_000, 10], [-2_000, 35], [-1_000, 60], [0, 85], [1_000, 92], [2_000, 100]]);
}

export function calculateEntryCompleteness(components: EntryPriceComponents): number {
  return (Object.keys(ENTRY_COMPONENT_WEIGHTS) as EntryComponentKey[]).reduce((total, key) => total + (components[key] === null ? 0 : ENTRY_COMPONENT_WEIGHTS[key]), 0);
}

export function calculateEntryConfidence(completeness: number): EntryConfidence {
  if (completeness >= 80) return "HIGH";
  if (completeness >= 60) return "MEDIUM";
  if (completeness >= 35) return "LOW";
  return "INSUFFICIENT";
}

export function calculateRobustHistoricalLow(values: readonly number[]): number | null {
  const valid = values.filter((value) => Number.isInteger(value) && value > 0).sort((left, right) => left - right);
  if (valid.length < 3) return null;
  return valid[Math.floor(valid.length * 0.2)];
}

export function calculateEntryPriceScore(input: EntryPriceInput): EntryPriceResult {
  if ((input.stockStatus !== "in_stock" && input.stockStatus !== "preorder") || input.productPriceCents <= 0 || input.comparablePriceCents <= 0) {
    const components: EntryPriceComponents = { marketReference: null, thirtyDayTypical: null, thirtyDayLow: null, msrp: null, momentum: null };
    return { score: null, completeness: 0, confidence: "INSUFFICIENT", comparisonBasis: input.comparisonBasis, components, thirtyDayMedianCents: null, thirtyDayLowCents: null, marketReferenceCents: null };
  }
  const validHistory = input.thirtyDayComparablePrices.filter((value) => Number.isInteger(value) && value > 0);
  const median = validHistory.length >= 3 ? calculateMedian(validHistory) : null;
  const low = calculateRobustHistoricalLow(validHistory);
  const compatibleMarket = input.marketReference?.comparisonBasis === input.comparisonBasis ? input.marketReference : null;
  const components: EntryPriceComponents = {
    marketReference: compatibleMarket ? calculatePriceVsMarketScore(input.comparablePriceCents, compatibleMarket.priceCents) : null,
    thirtyDayTypical: median === null ? null : calculatePriceVsHistoryScore(input.comparablePriceCents, median),
    thirtyDayLow: low === null ? null : calculateDistanceFromLowScore(input.comparablePriceCents, low),
    msrp: input.retailPriceCents === null ? null : calculateMsrpEntryScore(input.productPriceCents, input.retailPriceCents),
    momentum: input.momentumScore === null ? null : Math.max(0, Math.min(100, Math.round(input.momentumScore))),
  };
  const completeness = calculateEntryCompleteness(components);
  const weighted = (Object.keys(ENTRY_COMPONENT_WEIGHTS) as EntryComponentKey[]).reduce((total, key) => total + (components[key] === null ? 0 : components[key] * ENTRY_COMPONENT_WEIGHTS[key]), 0);
  return { score: completeness === 0 ? null : Math.round(weighted / completeness), completeness, confidence: calculateEntryConfidence(completeness), comparisonBasis: input.comparisonBasis, components, thirtyDayMedianCents: median, thirtyDayLowCents: low, marketReferenceCents: compatibleMarket?.priceCents ?? null };
}
