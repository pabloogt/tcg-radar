import { describe, expect, it } from "vitest";
import { calculateMarketReference, calculateMedian, combineMarketReferences, type CurrentMarketListing, type MarketHistoryObservation, type MarketReference } from "./reference";

const now = new Date("2026-08-19T12:00:00Z");
const current = (priceCents: number, storeId: string, overrides: Partial<CurrentMarketListing> = {}): CurrentMarketListing => ({ productId: "product-es-etb", listingId: `listing-${storeId}`, storeId, priceCents, shippingCents: 0, shippingKnown: true, stockStatus: "in_stock", observedAt: now.toISOString(), ...overrides });
const historical = (priceCents: number, daysAgo: number, overrides: Partial<MarketHistoryObservation> = {}): MarketHistoryObservation => ({ productId: "product-es-etb", listingId: "listing-a", priceCents, shippingCents: 0, shippingKnown: true, stockStatus: "in_stock", observedAt: new Date(now.getTime() - daysAgo * 86_400_000).toISOString(), ...overrides });

describe("internal market reference", () => {
  it("calculates an integer median and midpoint", () => {
    expect(calculateMedian([4_990, 6_190, 6_290, 6_390, 12_000])).toBe(6_290);
    expect(calculateMedian([6_000, 6_201])).toBe(6_101);
  });

  it("uses the median of five stores despite extreme high and low outliers", () => {
    const result = calculateMarketReference({ productId: "product-es-etb", currentListings: [current(100, "a"), current(6_190, "b"), current(6_290, "c"), current(6_390, "d"), current(120_000, "e")], history: [], now });
    expect(result.reference).toMatchObject({ referencePriceCents: 6_290, confidence: "HIGH", comparisonBasis: "TOTAL_ACQUISITION" });
  });

  it("returns high confidence for three independent current stores", () => {
    expect(calculateMarketReference({ productId: "product-es-etb", currentListings: [current(5_900, "a"), current(6_000, "b"), current(6_100, "c")], history: [], now }).confidence).toBe("HIGH");
  });

  it("returns medium confidence and midpoint for two stores", () => {
    const result = calculateMarketReference({ productId: "product-es-etb", currentListings: [current(6_000, "a"), current(6_200, "b")], history: [], now });
    expect(result.reference?.referencePriceCents).toBe(6_100);
    expect(result.confidence).toBe("MEDIUM");
  });

  it("combines one store with sufficient seven-day history at low confidence", () => {
    const history = [historical(6_000, 1), historical(6_200, 2), historical(6_100, 3)];
    const result = calculateMarketReference({ productId: "product-es-etb", currentListings: [current(5_900, "a")], history, now });
    expect(result.reference?.referencePriceCents).toBe(6_050);
    expect(result.confidence).toBe("LOW");
  });

  it("falls back to seven-day then thirty-day history", () => {
    const seven = Array.from({ length: 5 }, (_, index) => historical(6_000 + index * 100, index + 1));
    expect(calculateMarketReference({ productId: "product-es-etb", currentListings: [], history: seven, now })).toMatchObject({ confidence: "MEDIUM", reference: { referencePriceCents: 6_200 } });
    const thirty = Array.from({ length: 5 }, (_, index) => historical(7_000 + index * 100, index + 10));
    expect(calculateMarketReference({ productId: "product-es-etb", currentListings: [], history: thirty, now })).toMatchObject({ confidence: "LOW", reference: { referencePriceCents: 7_200 } });
  });

  it("returns insufficient instead of inventing a reference", () => {
    expect(calculateMarketReference({ productId: "product-es-etb", currentListings: [current(6_000, "a")], history: [], now })).toEqual({ reference: null, confidence: "INSUFFICIENT", reason: "No hay suficientes precios comparables." });
  });

  it("never mixes another normalized product, language, or product type", () => {
    const result = calculateMarketReference({ productId: "product-es-etb", currentListings: [current(6_000, "a"), current(100, "b", { productId: "product-en-etb" }), current(100, "c", { productId: "product-es-box" })], history: [], now });
    expect(result.confidence).toBe("INSUFFICIENT");
  });

  it("ignores out-of-stock and malformed prices", () => {
    const result = calculateMarketReference({ productId: "product-es-etb", currentListings: [current(6_000, "a"), current(0, "b"), current(-5, "c"), current(5_000, "d", { stockStatus: "out_of_stock" })], history: [], now });
    expect(result.confidence).toBe("INSUFFICIENT");
  });

  it("falls back to a base-price reference without treating unknown shipping as zero", () => {
    const listings = [current(5_000, "a", { shippingKnown: false, shippingCents: null }), current(5_200, "b", { shippingKnown: false, shippingCents: null }), current(5_400, "c", { shippingKnown: false, shippingCents: null })];
    expect(calculateMarketReference({ productId: "product-es-etb", currentListings: listings, history: [], now }).reference).toMatchObject({ comparisonBasis: "BASE_PRICE", referencePriceCents: 5_200 });
  });

  it("combines future compatible provider references without coupling to a provider", () => {
    const base: MarketReference = { productId: "product-es-etb", referencePriceCents: 6_000, comparisonBasis: "BASE_PRICE", source: "internal_market", confidence: "MEDIUM", observedAt: now.toISOString(), components: { currentStores: 2, sevenDayObservations: 0, thirtyDayObservations: 0, description: "2 tiendas" } };
    const result = combineMarketReferences("product-es-etb", [base, { ...base, referencePriceCents: 6_300, source: "external_market", confidence: "HIGH" }], now.toISOString());
    expect(result.reference).toMatchObject({ referencePriceCents: 6_180, source: "combined", confidence: "HIGH" });
  });
});
