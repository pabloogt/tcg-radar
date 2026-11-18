import { z } from "zod";
import type { ComparisonBasis, MarketReference } from "./reference";

export const dealClassificationSchema = z.enum(["CHOLLO", "OPPORTUNITY", "GOOD_PRICE", "NORMAL", "EXPENSIVE"]);
export type DealClassification = z.infer<typeof dealClassificationSchema>;

export const dealThresholdsSchema = z.object({
  goodPriceBps: z.int().min(0).max(5_000),
  opportunityBps: z.int().min(1).max(10_000),
  bargainBps: z.int().min(2).max(10_000),
  expensiveBps: z.int().min(1).max(10_000),
}).superRefine((thresholds, context) => {
  if (thresholds.goodPriceBps >= thresholds.opportunityBps) context.addIssue({ code: "custom", path: ["opportunityBps"], message: "Opportunity must be above good price" });
  if (thresholds.opportunityBps >= thresholds.bargainBps) context.addIssue({ code: "custom", path: ["bargainBps"], message: "Bargain must be above opportunity" });
});

export type DealThresholds = z.infer<typeof dealThresholdsSchema>;
export const DEFAULT_DEAL_THRESHOLDS: DealThresholds = { goodPriceBps: 0, opportunityBps: 800, bargainBps: 1_500, expensiveBps: 1_000 };

export type DealListing = {
  listingId: string;
  productId: string;
  priceCents: number;
  shippingCents: number | null;
  shippingKnown: boolean;
  stockStatus: string;
};

export type DealEvaluation = {
  listingId: string;
  productId: string;
  classification: DealClassification | null;
  listingPriceCents: number;
  candidateComparableCents: number | null;
  marketReferenceCents: number;
  differenceCents: number | null;
  differenceBps: number | null;
  comparisonBasis: ComparisonBasis;
  referenceSource: MarketReference["source"];
  referenceConfidence: MarketReference["confidence"];
  reasons: string[];
};

export function calculateDifferenceBps(referenceCents: number, candidateCents: number): number | null {
  if (!Number.isInteger(referenceCents) || referenceCents <= 0 || !Number.isInteger(candidateCents) || candidateCents < 0) return null;
  return Math.round(((referenceCents - candidateCents) * 10_000) / referenceCents);
}

export function classifyDeal(differenceBps: number, thresholds: DealThresholds = DEFAULT_DEAL_THRESHOLDS): DealClassification {
  const valid = dealThresholdsSchema.parse(thresholds);
  if (differenceBps >= valid.bargainBps) return "CHOLLO";
  if (differenceBps >= valid.opportunityBps) return "OPPORTUNITY";
  if (differenceBps >= valid.goodPriceBps) return "GOOD_PRICE";
  if (differenceBps <= -valid.expensiveBps) return "EXPENSIVE";
  return "NORMAL";
}

function percentageReason(differenceBps: number): string {
  const value = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Math.abs(differenceBps) / 100);
  return differenceBps >= 0 ? `${value} % por debajo de la referencia estimada.` : `${value} % por encima de la referencia estimada.`;
}

export function evaluateDeal(listing: DealListing, reference: MarketReference, thresholds: DealThresholds = DEFAULT_DEAL_THRESHOLDS): DealEvaluation {
  let comparable: number | null = null;
  if (reference.comparisonBasis === "BASE_PRICE") comparable = listing.priceCents;
  if (reference.comparisonBasis === "TOTAL_ACQUISITION" && listing.shippingKnown && listing.shippingCents !== null) comparable = listing.priceCents + listing.shippingCents;
  if (comparable === null) return { listingId: listing.listingId, productId: listing.productId, classification: null, listingPriceCents: listing.priceCents, candidateComparableCents: null, marketReferenceCents: reference.referencePriceCents, differenceCents: null, differenceBps: null, comparisonBasis: "INCOMPLETE", referenceSource: reference.source, referenceConfidence: reference.confidence, reasons: ["El envío es desconocido y la referencia usa coste total.", `Referencia basada en ${reference.components.description}.`] };
  const differenceCents = reference.referencePriceCents - comparable;
  const differenceBps = calculateDifferenceBps(reference.referencePriceCents, comparable);
  if (differenceBps === null) return { listingId: listing.listingId, productId: listing.productId, classification: null, listingPriceCents: listing.priceCents, candidateComparableCents: comparable, marketReferenceCents: reference.referencePriceCents, differenceCents: null, differenceBps: null, comparisonBasis: "INCOMPLETE", referenceSource: reference.source, referenceConfidence: reference.confidence, reasons: ["No se puede calcular una diferencia válida."] };
  return { listingId: listing.listingId, productId: listing.productId, classification: classifyDeal(differenceBps, thresholds), listingPriceCents: listing.priceCents, candidateComparableCents: comparable, marketReferenceCents: reference.referencePriceCents, differenceCents, differenceBps, comparisonBasis: reference.comparisonBasis, referenceSource: reference.source, referenceConfidence: reference.confidence, reasons: [percentageReason(differenceBps), `Referencia basada en ${reference.components.description}.`] };
}

const actionableRank: Record<DealClassification, number> = { EXPENSIVE: 0, NORMAL: 1, GOOD_PRICE: 2, OPPORTUNITY: 3, CHOLLO: 4 };

export function detectClassificationCrossing(previous: DealClassification | null, current: DealClassification | null): boolean {
  if (!current || actionableRank[current] < actionableRank.GOOD_PRICE) return false;
  if (!previous) return true;
  return actionableRank[current] > actionableRank[previous];
}
