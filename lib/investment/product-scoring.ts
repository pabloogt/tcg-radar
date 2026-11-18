import type { InvestmentHorizon } from "./config";
import { PRODUCT_INVESTMENT_WEIGHTS } from "./product-config";
import { calculateScoreConfidence, classifyInvestmentScore, type HorizonScores, type InvestmentScore, type ScoreConfidence } from "./scoring";
import type { EntryPriceResult } from "./entry-price";

export type ProductInvestmentWarning = "UNATTRACTIVE_ENTRY" | "LOW_MARKET_CONFIDENCE" | "UNKNOWN_SHIPPING" | "INSUFFICIENT_HISTORY" | "OUT_OF_STOCK" | "LOW_SET_COMPLETENESS" | "ABOVE_MARKET";

export type ProductInvestmentReasons = { positives: string[]; negatives: string[] };

export type ProductInvestmentResult = {
  productId: string;
  setId: string;
  setScores: HorizonScores;
  productVehicleScore: number;
  entryPrice: EntryPriceResult;
  finalScores: HorizonScores;
  bestListingId: string | null;
  bestListingPriceCents: number | null;
  purchasable: boolean;
  inStock: boolean;
  shippingKnown: boolean | null;
  reasons: ProductInvestmentReasons;
  warnings: ProductInvestmentWarning[];
};

function finalScore(setScore: InvestmentScore, vehicleScore: number, entry: EntryPriceResult, horizon: InvestmentHorizon): InvestmentScore {
  const weights = PRODUCT_INVESTMENT_WEIGHTS[horizon];
  const available = [
    ...(setScore.score === null ? [] : [{ score: setScore.score, weight: weights.set }]),
    { score: vehicleScore, weight: weights.vehicle },
    ...(entry.score === null ? [] : [{ score: entry.score, weight: weights.entry }]),
  ];
  const totalWeight = available.reduce((total, component) => total + component.weight, 0);
  const score = Math.round(available.reduce((total, component) => total + component.score * component.weight, 0) / totalWeight);
  const completeness = Math.round((weights.set * setScore.dataCompleteness) / 100 + weights.vehicle + (weights.entry * entry.completeness) / 100);
  return { score, dataCompleteness: completeness, confidence: calculateScoreConfidence(completeness), label: classifyInvestmentScore(score) };
}

export function calculateProductInvestmentScores(setScores: HorizonScores, vehicleScore: number, entry: EntryPriceResult): HorizonScores {
  return { short: finalScore(setScores.short, vehicleScore, entry, "short"), medium: finalScore(setScores.medium, vehicleScore, entry, "medium"), long: finalScore(setScores.long, vehicleScore, entry, "long") };
}

export function classifyProductInvestment(score: number) {
  return classifyInvestmentScore(score);
}

export function getProductInvestmentWarnings(input: { setScores: HorizonScores; entry: EntryPriceResult; stockStatus: string | null; shippingKnown: boolean | null; marketConfidence: string | null }): ProductInvestmentWarning[] {
  const warnings: ProductInvestmentWarning[] = [];
  if (input.entry.score !== null && input.entry.score < 50) warnings.push("UNATTRACTIVE_ENTRY");
  if (input.marketConfidence === "LOW") warnings.push("LOW_MARKET_CONFIDENCE");
  if (input.shippingKnown === false) warnings.push("UNKNOWN_SHIPPING");
  if (input.entry.components.thirtyDayTypical === null || input.entry.components.thirtyDayLow === null) warnings.push("INSUFFICIENT_HISTORY");
  if (input.stockStatus !== "in_stock" && input.stockStatus !== "preorder") warnings.push("OUT_OF_STOCK");
  if (Object.values(input.setScores).some((score) => score.dataCompleteness < 65)) warnings.push("LOW_SET_COMPLETENESS");
  if ((input.entry.components.marketReference ?? 100) < 68) warnings.push("ABOVE_MARKET");
  return warnings;
}

export function getProductInvestmentReasons(input: { setScores: HorizonScores; vehicleScore: number; entry: EntryPriceResult }): ProductInvestmentReasons {
  const positives: string[] = [];
  const negatives: string[] = [];
  const longSet = input.setScores.long.score;
  if (longSet !== null && longSet >= 75) positives.push(`Calidad de la colección: ${longSet}/100.`);
  if (input.vehicleScore >= 80) positives.push(`Formato sellado sólido: ${input.vehicleScore}/100.`);
  if (input.entry.score !== null && input.entry.score >= 75) positives.push(`Entrada actual atractiva: ${input.entry.score}/100.`);
  if (longSet !== null && longSet < 60) negatives.push(`Calidad de la colección limitada: ${longSet}/100.`);
  if (input.vehicleScore < 60) negatives.push(`Formato de inversión débil: ${input.vehicleScore}/100.`);
  if (input.entry.score !== null && input.entry.score < 55) negatives.push(`Precio de entrada poco atractivo: ${input.entry.score}/100.`);
  return { positives: positives.slice(0, 3), negatives: negatives.slice(0, 2) };
}

export function buildProductInvestmentResult(input: {
  productId: string;
  setId: string;
  setScores: HorizonScores;
  vehicleScore: number;
  entry: EntryPriceResult;
  bestListing: { id: string; priceCents: number; stockStatus: string; shippingKnown: boolean } | null;
  marketConfidence: string | null;
}): ProductInvestmentResult {
  return {
    productId: input.productId,
    setId: input.setId,
    setScores: input.setScores,
    productVehicleScore: input.vehicleScore,
    entryPrice: input.entry,
    finalScores: calculateProductInvestmentScores(input.setScores, input.vehicleScore, input.entry),
    bestListingId: input.bestListing?.id ?? null,
    bestListingPriceCents: input.bestListing?.priceCents ?? null,
    purchasable: input.bestListing ? input.bestListing.stockStatus === "in_stock" || input.bestListing.stockStatus === "preorder" : false,
    inStock: input.bestListing?.stockStatus === "in_stock",
    shippingKnown: input.bestListing?.shippingKnown ?? null,
    reasons: getProductInvestmentReasons({ setScores: input.setScores, vehicleScore: input.vehicleScore, entry: input.entry }),
    warnings: getProductInvestmentWarnings({ setScores: input.setScores, entry: input.entry, stockStatus: input.bestListing?.stockStatus ?? null, shippingKnown: input.bestListing?.shippingKnown ?? null, marketConfidence: input.marketConfidence }),
  };
}

export type ProductSelectionCandidate = ProductInvestmentResult & { language: string; productType: string };

const confidenceRank: Record<ScoreConfidence | EntryPriceResult["confidence"], number> = { HIGH: 0, MEDIUM: 1, LOW: 2, INSUFFICIENT: 3 };

export function selectBestInvestmentVehicle<T extends ProductSelectionCandidate>(products: readonly T[], horizon: InvestmentHorizon): T | null {
  const weights = PRODUCT_INVESTMENT_WEIGHTS[horizon];
  const scored = products.flatMap((product) => {
    const setScore = product.setScores[horizon].score;
    if (setScore === null) return [];
    return [{ product, score: Math.round((setScore * weights.set + product.productVehicleScore * weights.vehicle) / (weights.set + weights.vehicle)) }];
  });
  return scored.sort((left, right) => right.score - left.score || confidenceRank[left.product.setScores[horizon].confidence] - confidenceRank[right.product.setScores[horizon].confidence] || left.product.productId.localeCompare(right.product.productId))[0]?.product ?? null;
}

export function selectBestCurrentBuy<T extends ProductSelectionCandidate>(products: readonly T[], horizon: InvestmentHorizon): T | null {
  return [...products].filter((product) => product.purchasable && product.entryPrice.confidence !== "INSUFFICIENT" && product.finalScores[horizon].score !== null).sort((left, right) => (right.finalScores[horizon].score ?? -1) - (left.finalScores[horizon].score ?? -1) || confidenceRank[left.entryPrice.confidence] - confidenceRank[right.entryPrice.confidence] || Number(right.inStock) - Number(left.inStock) || Number(right.shippingKnown) - Number(left.shippingKnown) || left.productId.localeCompare(right.productId))[0] ?? null;
}

export type ProductSnapshotValues = { shortScore: number | null; mediumScore: number | null; longScore: number | null; setShortScore: number | null; setMediumScore: number | null; setLongScore: number | null; vehicleScore: number; entryScore: number | null; entryConfidence: EntryPriceResult["confidence"]; entryCompleteness: number; bestListingPriceCents: number | null; marketReferenceCents: number | null };

export function productInvestmentFingerprint(values: ProductSnapshotValues): string {
  return [values.shortScore, values.mediumScore, values.longScore, values.setShortScore, values.setMediumScore, values.setLongScore, values.vehicleScore, values.entryScore, values.entryConfidence, values.entryCompleteness, values.bestListingPriceCents, values.marketReferenceCents].map((value) => value ?? "null").join(":");
}

export function shouldCreateProductInvestmentSnapshot(previousFingerprint: string | null, next: ProductSnapshotValues): boolean {
  return previousFingerprint !== productInvestmentFingerprint(next);
}
