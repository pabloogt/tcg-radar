import { describe, expect, it } from "vitest";
import { calculateDifferenceBps, classifyDeal, dealThresholdsSchema, detectClassificationCrossing, evaluateDeal, type DealListing } from "./deal";
import type { MarketReference } from "./reference";

const reference: MarketReference = { productId: "product", referencePriceCents: 10_000, comparisonBasis: "TOTAL_ACQUISITION", source: "internal_market", confidence: "MEDIUM", observedAt: "2026-08-19T12:00:00Z", components: { currentStores: 2, sevenDayObservations: 0, thirtyDayObservations: 0, description: "2 tiendas actuales" } };
const listing = (priceCents: number, overrides: Partial<DealListing> = {}): DealListing => ({ listingId: "listing", productId: "product", priceCents, shippingCents: 0, shippingKnown: true, stockStatus: "in_stock", ...overrides });

describe("deal classification", () => {
  it.each([
    [10_000, "GOOD_PRICE"], [9_900, "GOOD_PRICE"], [9_200, "OPPORTUNITY"], [8_501, "OPPORTUNITY"], [8_500, "CHOLLO"], [10_500, "NORMAL"], [11_000, "EXPENSIVE"],
  ] as const)("classifies candidate %i deterministically as %s", (candidate, expected) => {
    const difference = calculateDifferenceBps(10_000, candidate);
    expect(difference).not.toBeNull();
    expect(classifyDeal(difference!)).toBe(expected);
  });

  it("supports custom thresholds", () => {
    const custom = { goodPriceBps: 0, opportunityBps: 500, bargainBps: 1_200, expensiveBps: 1_000 };
    expect(classifyDeal(500, custom)).toBe("OPPORTUNITY");
    expect(classifyDeal(1_200, custom)).toBe("CHOLLO");
  });

  it("rejects overlapping thresholds", () => {
    expect(dealThresholdsSchema.safeParse({ goodPriceBps: 0, opportunityBps: 1_500, bargainBps: 1_200, expensiveBps: 1_000 }).success).toBe(false);
  });

  it("compares confirmed totals correctly", () => {
    expect(evaluateDeal(listing(8_500, { shippingCents: 500 }), reference)).toMatchObject({ candidateComparableCents: 9_000, differenceCents: 1_000, differenceBps: 1_000, classification: "OPPORTUNITY", comparisonBasis: "TOTAL_ACQUISITION" });
  });

  it("does not treat unknown shipping as zero against a total reference", () => {
    expect(evaluateDeal(listing(8_500, { shippingKnown: false, shippingCents: null }), reference)).toMatchObject({ classification: null, differenceBps: null, comparisonBasis: "INCOMPLETE" });
  });

  it("compares base price to base price when the provider explicitly uses that basis", () => {
    expect(evaluateDeal(listing(8_500, { shippingKnown: false, shippingCents: null }), { ...reference, comparisonBasis: "BASE_PRICE" })).toMatchObject({ classification: "CHOLLO", candidateComparableCents: 8_500, comparisonBasis: "BASE_PRICE" });
  });

  it("detects only crossings into a stronger actionable category", () => {
    expect(detectClassificationCrossing("NORMAL", "GOOD_PRICE")).toBe(true);
    expect(detectClassificationCrossing("GOOD_PRICE", "OPPORTUNITY")).toBe(true);
    expect(detectClassificationCrossing("OPPORTUNITY", "CHOLLO")).toBe(true);
    expect(detectClassificationCrossing("CHOLLO", "CHOLLO")).toBe(false);
    expect(detectClassificationCrossing("CHOLLO", "NORMAL")).toBe(false);
    expect(detectClassificationCrossing("NORMAL", "CHOLLO")).toBe(true);
  });
});
