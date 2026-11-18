import { describe, expect, it } from "vitest";
import { evaluateDeal } from "@/lib/market/deal";
import type { MarketReference } from "@/lib/market/reference";
import { createDealAlertCandidate } from "./deal-alerts";

const reference: MarketReference = { productId: "p", referencePriceCents: 10_000, comparisonBasis: "BASE_PRICE", source: "internal_market", confidence: "HIGH", observedAt: "2026-08-19T12:00:00Z", components: { currentStores: 3, sevenDayObservations: 0, thirtyDayObservations: 0, description: "3 tiendas actuales" } };
const preferences = { alertBargains: true, alertOpportunities: true, alertGoodPrices: false };
function candidate(previousClassification: "CHOLLO" | "OPPORTUNITY" | "GOOD_PRICE" | "NORMAL" | "EXPENSIVE" | null, priceCents: number, overrides = {}) {
  return createDealAlertCandidate({ previousClassification, evaluation: evaluateDeal({ listingId: "l", productId: "p", priceCents, shippingCents: null, shippingKnown: false, stockStatus: "in_stock" }, reference), preferences, observedAt: "2026-08-19T12:00:00Z", productName: "ETB", tcg: "pokemon", language: "es", storeId: "s", storeName: "Tienda", listingUrl: "https://example.com", stockStatus: "in_stock", shippingCents: null, oldPriceCents: 10_500, ...overrides });
}

describe("deal alert preparation", () => {
  it("prepares bargain and opportunity crossings", () => {
    expect(candidate("NORMAL", 8_500)).toMatchObject({ alertType: "deal_bargain", dealClassification: "CHOLLO" });
    expect(candidate("GOOD_PRICE", 9_200)).toMatchObject({ alertType: "deal_opportunity", dealClassification: "OPPORTUNITY" });
  });
  it("keeps good-price alerts off by default", () => expect(candidate("NORMAL", 10_000)).toBeNull());
  it("allows good-price alerts when enabled", () => expect(candidate("NORMAL", 10_000, { preferences: { ...preferences, alertGoodPrices: true } })).toMatchObject({ alertType: "deal_good_price" }));
  it("does not repeat the same category", () => expect(candidate("CHOLLO", 8_000)).toBeNull());
  it("does not alert unavailable listings", () => expect(candidate("NORMAL", 8_000, { stockStatus: "out_of_stock" })).toBeNull());
  it("uses a deterministic observation-cycle dedupe key", () => expect(candidate("NORMAL", 8_000)?.dedupeKey).toBe("deal:l:CHOLLO:2026-08-19T12:00:00Z"));
});
