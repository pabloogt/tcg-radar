import { describe, expect, it } from "vitest";
import type { EntryPriceResult } from "./entry-price";
import { buildProductInvestmentResult, calculateProductInvestmentScores, productInvestmentFingerprint, selectBestCurrentBuy, selectBestInvestmentVehicle, shouldCreateProductInvestmentSnapshot, type ProductSelectionCandidate, type ProductSnapshotValues } from "./product-scoring";
import type { HorizonScores, InvestmentScore } from "./scoring";
import { PRODUCT_INVESTMENT_WEIGHTS } from "./product-config";

const score = (value: number, completeness = 100): InvestmentScore => ({ score: value, dataCompleteness: completeness, confidence: completeness >= 85 ? "HIGH" : completeness >= 65 ? "MEDIUM" : completeness >= 40 ? "LOW" : "INSUFFICIENT", label: value >= 90 ? "EXCEPTIONAL" : value >= 80 ? "STRONG" : value >= 70 ? "INTERESTING" : value >= 60 ? "WATCH" : "WEAK" });
const sets = (short: number, medium = short, long = short): HorizonScores => ({ short: score(short), medium: score(medium), long: score(long) });
const entry = (value: number | null, completeness = 100): EntryPriceResult => ({ score: value, completeness, confidence: completeness >= 80 ? "HIGH" : completeness >= 60 ? "MEDIUM" : completeness >= 35 ? "LOW" : "INSUFFICIENT", comparisonBasis: "TOTAL_ACQUISITION", components: { marketReference: value, thirtyDayTypical: value, thirtyDayLow: value, msrp: value, momentum: value }, thirtyDayMedianCents: 5_000, thirtyDayLowCents: 4_500, marketReferenceCents: 5_500 });

function candidate(id: string, values: { set?: HorizonScores; vehicle?: number; entry?: EntryPriceResult; stock?: string; shippingKnown?: boolean; language?: string } = {}): ProductSelectionCandidate {
  const result = buildProductInvestmentResult({ productId: id, setId: "set", setScores: values.set ?? sets(80), vehicleScore: values.vehicle ?? 80, entry: values.entry ?? entry(80), bestListing: values.stock === "none" ? null : { id: `listing-${id}`, priceCents: 5_000, stockStatus: values.stock ?? "in_stock", shippingKnown: values.shippingKnown ?? true }, marketConfidence: "HIGH" });
  return { ...result, language: values.language ?? "es", productType: "booster_box" };
}

describe("product investment composition", () => {
  it("keeps every product horizon at exactly 100 percent", () => { for (const weights of Object.values(PRODUCT_INVESTMENT_WEIGHTS)) expect(weights.set + weights.vehicle + weights.entry).toBe(100); });
  it("makes cheap entry affect short more than long", () => { const high = calculateProductInvestmentScores(sets(70), 70, entry(100)); const low = calculateProductInvestmentScores(sets(70), 70, entry(20)); expect(high.short.score! - low.short.score!).toBeGreaterThan(high.long.score! - low.long.score!); });
  it("makes strong set quality affect long more than short", () => { const high = calculateProductInvestmentScores(sets(100), 60, entry(60)); const low = calculateProductInvestmentScores(sets(20), 60, entry(60)); expect(high.long.score! - low.long.score!).toBeGreaterThan(high.short.score! - low.short.score!); });
  it("lets a weak vehicle reduce long-term quality", () => expect(calculateProductInvestmentScores(sets(90), 40, entry(80)).long.score).toBeLessThan(calculateProductInvestmentScores(sets(90), 90, entry(80)).long.score!));
  it("gives the same product different horizon scores", () => { const result = calculateProductInvestmentScores(sets(55, 75, 95), 90, entry(40)); expect(new Set([result.short.score, result.medium.score, result.long.score]).size).toBe(3); });
  it("selects an in-stock high-score current buy", () => expect(selectBestCurrentBuy([candidate("low", { entry: entry(60) }), candidate("high", { entry: entry(95) })], "short")?.productId).toBe("high"));
  it("does not choose out-of-stock when an equivalent product is available", () => expect(selectBestCurrentBuy([candidate("sold", { entry: entry(95), stock: "none" }), candidate("available", { entry: entry(95) })], "long")?.productId).toBe("available"));
  it("uses confidence to break similar results and keeps unknown shipping explicit", () => { const low = candidate("low-confidence", { entry: entry(80, 35), shippingKnown: false }); const high = candidate("high-confidence", { entry: entry(80, 100) }); low.finalScores.short = high.finalScores.short; expect(selectBestCurrentBuy([low, high], "short")?.productId).toBe("high-confidence"); expect(low.warnings).toContain("UNKNOWN_SHIPPING"); });
  it("selects the best vehicle independently of store availability", () => expect(selectBestInvestmentVehicle([candidate("available", { vehicle: 70 }), candidate("sold", { vehicle: 95, stock: "none" })], "long")?.productId).toBe("sold"));
  it("keeps language-specific products as separate candidates", () => { const spanish = candidate("spanish", { language: "es", vehicle: 80 }); const english = candidate("english", { language: "en", vehicle: 81 }); expect([spanish, english]).toHaveLength(2); expect(selectBestInvestmentVehicle([spanish, english], "long")?.language).toBe("en"); });
});

describe("product investment snapshots", () => {
  const values: ProductSnapshotValues = { shortScore: 80, mediumScore: 82, longScore: 84, setShortScore: 78, setMediumScore: 82, setLongScore: 88, vehicleScore: 92, entryScore: 70, entryConfidence: "HIGH", entryCompleteness: 100, bestListingPriceCents: 5_000, marketReferenceCents: 6_000 };
  it("creates a snapshot for a meaningful score change", () => expect(shouldCreateProductInvestmentSnapshot(productInvestmentFingerprint(values), { ...values, longScore: 85 })).toBe(true));
  it("does not create a meaningless duplicate", () => expect(shouldCreateProductInvestmentSnapshot(productInvestmentFingerprint(values), { ...values })).toBe(false));
});
