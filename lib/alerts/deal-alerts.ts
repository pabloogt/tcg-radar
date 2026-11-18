import type { AlertCandidate } from "./evaluate-alerts";
import { detectClassificationCrossing, type DealClassification, type DealEvaluation } from "@/lib/market/deal";

export type DealAlertPreferences = {
  alertBargains: boolean;
  alertOpportunities: boolean;
  alertGoodPrices: boolean;
};

function enabled(classification: DealClassification, preferences: DealAlertPreferences): boolean {
  if (classification === "CHOLLO") return preferences.alertBargains;
  if (classification === "OPPORTUNITY") return preferences.alertOpportunities;
  if (classification === "GOOD_PRICE") return preferences.alertGoodPrices;
  return false;
}

export function createDealAlertCandidate(input: {
  previousClassification: DealClassification | null;
  evaluation: DealEvaluation;
  preferences: DealAlertPreferences;
  observedAt: string;
  productName: string;
  tcg: string;
  language: string;
  storeId: string;
  storeName: string;
  listingUrl: string;
  stockStatus: string;
  shippingCents: number | null;
  oldPriceCents: number | null;
}): AlertCandidate | null {
  const classification = input.evaluation.classification;
  const purchasable = input.stockStatus === "in_stock" || input.stockStatus === "preorder";
  if (!purchasable || !classification || !enabled(classification, input.preferences) || !detectClassificationCrossing(input.previousClassification, classification)) return null;
  const alertType = classification === "CHOLLO" ? "deal_bargain" : classification === "OPPORTUNITY" ? "deal_opportunity" : "deal_good_price";
  return {
    alertType,
    productId: input.evaluation.productId,
    productName: input.productName,
    tcg: input.tcg,
    language: input.language,
    storeId: input.storeId,
    storeName: input.storeName,
    listingId: input.evaluation.listingId,
    listingUrl: input.listingUrl,
    stockStatus: input.stockStatus,
    shippingCents: input.shippingCents,
    oldPriceCents: input.oldPriceCents,
    newPriceCents: input.evaluation.listingPriceCents,
    targetPriceCents: null,
    totalAcquisitionCostCents: input.evaluation.comparisonBasis === "TOTAL_ACQUISITION" ? input.evaluation.candidateComparableCents : null,
    financialRecommendation: null,
    dealClassification: classification,
    marketReferenceCents: input.evaluation.marketReferenceCents,
    marketDifferenceBps: input.evaluation.differenceBps,
    comparisonBasis: input.evaluation.comparisonBasis,
    referenceConfidence: input.evaluation.referenceConfidence,
    reason: input.evaluation.reasons.join(" "),
    dedupeKey: `deal:${input.evaluation.listingId}:${classification}:${input.observedAt}`,
  };
}
