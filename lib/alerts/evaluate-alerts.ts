import type { OpportunityResult } from "@/lib/finance/opportunity";

export type AlertType = "price_drop" | "back_in_stock" | "target_price" | "financial_opportunity";

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
  reason: string;
  dedupeKey: string;
};

export type AlertContext = {
  productId: string;
  productName: string;
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
};

const DEFAULT_MINIMUM_PRICE_DROP_BASIS_POINTS = 500;

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
  const minimumDrop = context.minimumPriceDropBasisPoints ?? DEFAULT_MINIMUM_PRICE_DROP_BASIS_POINTS;
  const priceDropMeetsThreshold = context.oldPriceCents !== null
    && context.oldPriceCents > 0
    && context.newPriceCents < context.oldPriceCents
    && (context.oldPriceCents - context.newPriceCents) * 10_000 >= context.oldPriceCents * minimumDrop;

  if (priceDropMeetsThreshold) {
    candidates.push({ ...base, alertType: "price_drop", financialRecommendation: context.evaluation?.recommendation ?? null, reason: `Precio reducido de ${context.oldPriceCents} a ${context.newPriceCents} céntimos.`, dedupeKey: `price_drop:${context.listingId}:${context.newPriceCents}` });
  }
  if (context.oldStockStatus === "out_of_stock" && context.newStockStatus === "in_stock") {
    candidates.push({ ...base, alertType: "back_in_stock", financialRecommendation: context.evaluation?.recommendation ?? null, reason: "El producto vuelve a estar disponible.", dedupeKey: `back_in_stock:${context.listingId}:out_of_stock:in_stock:${context.newPriceCents}` });
  }
  if (context.targetPriceCents !== undefined && context.oldPriceCents !== null && context.oldPriceCents > context.targetPriceCents && context.newPriceCents <= context.targetPriceCents) {
    candidates.push({ ...base, alertType: "target_price", financialRecommendation: context.evaluation?.recommendation ?? null, reason: `El precio ha cruzado el objetivo de ${context.targetPriceCents} céntimos.`, dedupeKey: `target_price:${context.listingId}:${context.targetPriceCents}:${context.newPriceCents}` });
  }
  if (context.evaluation && (context.evaluation.recommendation === "BUY" || context.evaluation.recommendation === "STRONG_BUY")) {
    candidates.push({ ...base, alertType: "financial_opportunity", financialRecommendation: context.evaluation.recommendation, reason: context.evaluation.recommendation_explanation, dedupeKey: `financial:${context.listingId}:${context.newPriceCents}:${context.evaluation.recommendation}` });
  }
  return candidates;
}
