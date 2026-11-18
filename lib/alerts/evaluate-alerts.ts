import type { OpportunityResult } from "@/lib/finance/opportunity";
import type { ComparisonBasis, MarketReferenceConfidence } from "@/lib/market/reference";
import type { DealClassification } from "@/lib/market/deal";

export type AlertType = "new_product" | "price_drop" | "back_in_stock" | "target_price" | "financial_opportunity" | "new_price_low" | "deal_good_price" | "deal_opportunity" | "deal_bargain";

export type AlertCandidate = {
  alertType: AlertType;
  productId: string;
  productName: string;
  tcg: string;
  language: string;
  storeId: string;
  storeName: string;
  listingId: string;
  listingUrl: string;
  stockStatus: string;
  shippingCents: number | null;
  oldPriceCents: number | null;
  newPriceCents: number;
  targetPriceCents: number | null;
  totalAcquisitionCostCents: number | null;
  financialRecommendation: OpportunityResult["recommendation"] | null;
  priceLowPeriodDays?: 7 | 30;
  previousLowCents?: number;
  dealClassification?: DealClassification;
  marketReferenceCents?: number;
  marketDifferenceBps?: number | null;
  comparisonBasis?: ComparisonBasis;
  referenceConfidence?: Exclude<MarketReferenceConfidence, "INSUFFICIENT">;
  reason: string;
  dedupeKey: string;
};

export type AlertContext = {
  productId: string;
  productName: string;
  productType: string;
  tcg: string;
  language: string;
  storeId: string;
  storeName: string;
  listingId: string;
  listingUrl: string;
  oldPriceCents: number | null;
  oldStockStatus: string | null;
  newPriceCents: number;
  shippingCents: number | null;
  newStockStatus: string;
  targetPriceCents?: number;
  minimumPriceDropBasisPoints?: number;
  evaluation?: OpportunityResult;
  isNewListing?: boolean;
  newPriceLow?: { periodDays: 7 | 30; previousMinimumCents: number };
};

const DEFAULT_MINIMUM_PRICE_DROP_BASIS_POINTS = 500;
const ALERTABLE_SEALED_PRODUCT_TYPES = new Set([
  "elite_trainer_box",
  "booster_box",
  "booster_bundle",
  "collection_box",
  "tin",
  "starter_deck",
  "premium_collection",
  "other_sealed",
]);

export function isAlertableSealedProductType(productType: string): boolean {
  return ALERTABLE_SEALED_PRODUCT_TYPES.has(productType)
    || /^sealed_case_(?:[2-9]|[1-9]\d+)_(?:etb|booster_box)$/.test(productType);
}

export function evaluateAlertCandidates(context: AlertContext): AlertCandidate[] {
  const base = {
    productId: context.productId,
    productName: context.productName,
    tcg: context.tcg,
    language: context.language,
    storeId: context.storeId,
    storeName: context.storeName,
    listingId: context.listingId,
    listingUrl: context.listingUrl,
    stockStatus: context.newStockStatus,
    shippingCents: context.shippingCents,
    oldPriceCents: context.oldPriceCents,
    newPriceCents: context.newPriceCents,
    targetPriceCents: context.targetPriceCents ?? null,
    totalAcquisitionCostCents: context.shippingCents === null ? null : context.newPriceCents + context.shippingCents,
  };
  const candidates: AlertCandidate[] = [];
  const purchasable = context.newStockStatus === "in_stock" || context.newStockStatus === "preorder";
  const financiallyAttractive = context.evaluation?.recommendation === "BUY" || context.evaluation?.recommendation === "STRONG_BUY";
  const targetSatisfied = context.targetPriceCents !== undefined && context.newPriceCents <= context.targetPriceCents;

  if (context.isNewListing) {
    if (purchasable && isAlertableSealedProductType(context.productType)) {
      candidates.push({
        ...base,
        alertType: "new_product",
        financialRecommendation: null,
        reason: context.newStockStatus === "preorder" ? "Nuevo producto sellado disponible en preventa." : "Nuevo producto sellado disponible.",
        dedupeKey: `new_product:${context.listingId}`,
      });
    }
    return candidates;
  }

  const minimumDrop = context.minimumPriceDropBasisPoints ?? DEFAULT_MINIMUM_PRICE_DROP_BASIS_POINTS;
  const priceDropMeetsThreshold = context.oldPriceCents !== null
    && context.oldPriceCents > 0
    && context.newPriceCents < context.oldPriceCents
    && (context.oldPriceCents - context.newPriceCents) * 10_000 >= context.oldPriceCents * minimumDrop;
  const restocked = context.oldStockStatus === "out_of_stock" && context.newStockStatus === "in_stock";

  if (restocked && (targetSatisfied || financiallyAttractive)) {
    candidates.push({
      ...base,
      alertType: "back_in_stock",
      financialRecommendation: financiallyAttractive ? context.evaluation?.recommendation ?? null : null,
      reason: "El producto vuelve a estar disponible y cumple una condición de oportunidad.",
      dedupeKey: `back_in_stock:${context.listingId}:out_of_stock:in_stock:${context.newPriceCents}`,
    });
    return candidates;
  }

  if (purchasable && context.newPriceLow) {
    candidates.push({ ...base, alertType: "new_price_low", financialRecommendation: context.evaluation?.recommendation ?? null, priceLowPeriodDays: context.newPriceLow.periodDays, previousLowCents: context.newPriceLow.previousMinimumCents, reason: `Nuevo mínimo confirmado de ${context.newPriceLow.periodDays} días.`, dedupeKey: `price_drop:${context.listingId}:${context.newPriceCents}` });
  } else if (purchasable && priceDropMeetsThreshold) {
    candidates.push({ ...base, alertType: "price_drop", financialRecommendation: context.evaluation?.recommendation ?? null, reason: `Precio reducido de ${context.oldPriceCents} a ${context.newPriceCents} céntimos.`, dedupeKey: `price_drop:${context.listingId}:${context.newPriceCents}` });
  }
  if (restocked) {
    candidates.push({ ...base, alertType: "back_in_stock", financialRecommendation: context.evaluation?.recommendation ?? null, reason: "El producto vuelve a estar disponible.", dedupeKey: `back_in_stock:${context.listingId}:out_of_stock:in_stock:${context.newPriceCents}` });
  }
  if (purchasable && targetSatisfied && context.oldPriceCents !== null && context.targetPriceCents !== undefined && context.oldPriceCents > context.targetPriceCents) {
    candidates.push({ ...base, alertType: "target_price", financialRecommendation: context.evaluation?.recommendation ?? null, reason: `El precio ha cruzado el objetivo de ${context.targetPriceCents} céntimos.`, dedupeKey: `target_price:${context.listingId}:${context.targetPriceCents}:${context.newPriceCents}` });
  }
  if (purchasable && context.evaluation && financiallyAttractive) {
    candidates.push({ ...base, alertType: "financial_opportunity", financialRecommendation: context.evaluation.recommendation, reason: context.evaluation.recommendation_explanation, dedupeKey: `financial:${context.listingId}:${context.newPriceCents}:${context.evaluation.recommendation}` });
  }
  return candidates;
}
