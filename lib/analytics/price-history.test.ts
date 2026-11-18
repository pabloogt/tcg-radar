import { describe, expect, it } from "vitest";
import { aggregateDailyBestPrice, calculatePeriodStatistics, detectNewPriceLows, sortListingsForComparison, summarizeCurrentListings, type HistoricalPricePoint } from "./price-history";

const now = new Date("2026-08-19T12:00:00.000Z");
const point = (overrides: Partial<HistoricalPricePoint> = {}): HistoricalPricePoint => ({ listingId: "listing-a", priceCents: 5_000, shippingCents: 500, shippingKnown: true, stockStatus: "in_stock", recordedAt: "2026-08-19T10:00:00.000Z", ...overrides });

describe("listing comparison", () => {
  const listings = [
    { id: "known", storeId: "store-a", priceCents: 4_990, shippingCents: 490, shippingKnown: true, stockStatus: "in_stock", checkedAt: "2026-08-19T10:00:00Z" },
    { id: "unknown", storeId: "store-b", priceCents: 4_500, shippingCents: 0, shippingKnown: false, stockStatus: "in_stock", checkedAt: "2026-08-19T11:00:00Z" },
    { id: "sold", storeId: "store-c", priceCents: 3_000, shippingCents: 0, shippingKnown: true, stockStatus: "out_of_stock", checkedAt: "2026-08-19T12:00:00Z" },
  ];

  it("selects the cheapest confirmed purchasable listing", () => {
    expect(summarizeCurrentListings(listings).bestConfirmed?.id).toBe("known");
  });

  it("never treats unknown shipping as free or out-of-stock as actionable", () => {
    const summary = summarizeCurrentListings(listings);
    expect(summary.lowestBase?.id).toBe("unknown");
    expect(sortListingsForComparison(listings).map((listing) => listing.id)).toEqual(["known", "unknown", "sold"]);
  });
});

describe("price history analytics", () => {
  const points = [
    point({ priceCents: 5_000, shippingCents: 500, recordedAt: "2026-08-19T10:00:00.000Z" }),
    point({ priceCents: 5_500, shippingCents: 500, recordedAt: "2026-08-18T12:00:00.000Z" }),
    point({ priceCents: 6_000, shippingCents: 500, recordedAt: "2026-08-10T12:00:00.000Z" }),
    point({ priceCents: 8_000, shippingCents: 500, recordedAt: "2026-07-01T12:00:00.000Z" }),
  ];

  it("calculates 24-hour min, max and average", () => {
    expect(calculatePeriodStatistics(points, now, 24 * 60 * 60 * 1_000)).toEqual({ observations: 2, productPrice: { minimumCents: 5_000, maximumCents: 5_500, averageCents: 5_250 }, confirmedTotal: { minimumCents: 5_500, maximumCents: 6_000, averageCents: 5_750 } });
  });

  it("calculates 7-day and 30-day min, max and average", () => {
    expect(calculatePeriodStatistics(points, now, 7 * 86_400_000).productPrice).toEqual({ minimumCents: 5_000, maximumCents: 5_500, averageCents: 5_250 });
    expect(calculatePeriodStatistics(points, now, 30 * 86_400_000).productPrice).toEqual({ minimumCents: 5_000, maximumCents: 6_000, averageCents: 5_500 });
  });

  it("returns insufficient empty statistics", () => {
    expect(calculatePeriodStatistics([], now, 86_400_000)).toEqual({ observations: 0, productPrice: null, confirmedTotal: null });
  });

  it("supports store-specific history by filtering a listing", () => {
    const storePoints = [...points, point({ listingId: "listing-b", priceCents: 1_000 })].filter((entry) => entry.listingId === "listing-a");
    expect(calculatePeriodStatistics(storePoints, now, 30 * 86_400_000).observations).toBe(3);
  });

  it("builds confirmed and product-price-only daily best history", () => {
    expect(aggregateDailyBestPrice([
      point({ listingId: "a", priceCents: 5_000, shippingCents: 500, recordedAt: "2026-08-18T10:00:00Z" }),
      point({ listingId: "b", priceCents: 5_200, shippingCents: null, shippingKnown: false, recordedAt: "2026-08-18T11:00:00Z" }),
      point({ listingId: "b", priceCents: 4_900, shippingCents: null, shippingKnown: false, recordedAt: "2026-08-19T11:00:00Z" }),
    ])).toEqual([
      { date: "2026-08-18", cents: 5_500, kind: "confirmed_total" },
      { date: "2026-08-19", cents: 4_900, kind: "product_price_only" },
    ]);
  });

  it("detects new 7-day and 30-day confirmed lows", () => {
    const result = detectNewPriceLows(point({ priceCents: 4_500, shippingCents: 500 }), points, now);
    expect(result).toMatchObject({ new7DayLow: true, previous7DayMinimumCents: 5_500, new30DayLow: true, previous30DayMinimumCents: 5_500 });
  });

  it("does not detect lows for unknown shipping, unavailable stock, or repeated equal prices", () => {
    expect(detectNewPriceLows(point({ priceCents: 4_000, shippingKnown: false, shippingCents: null }), points, now).new30DayLow).toBe(false);
    expect(detectNewPriceLows(point({ priceCents: 4_000, stockStatus: "out_of_stock" }), points, now).new30DayLow).toBe(false);
    expect(detectNewPriceLows(point({ priceCents: 5_000 }), [point({ priceCents: 5_000 })], now).new7DayLow).toBe(false);
  });
});
