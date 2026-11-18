import { describe, expect, it } from "vitest";
import type { MarketSignalDataset } from "./repository";
import { calculateSetMarketIntelligence, marketIntelligenceToSetMetricSignals } from "./service";

const now = new Date("2026-09-13T12:00:00.000Z");

function dataset(): MarketSignalDataset {
  const products = Array.from({ length: 4 }, (_, index) => ({ id: `p${index + 1}`, setId: "set-1" }));
  const listings = products.map((product, index) => ({ id: `l${index + 1}`, productId: product.id, storeId: `s${index + 1}`, sourceKey: "monitor", stockStatus: "in_stock" as const, checkedAt: now.toISOString() }));
  const history = listings.flatMap((listing, index) => [
    { listingId: listing.id, priceCents: 6_000 + index * 100, shippingCents: 500, shippingKnown: true, stockStatus: "out_of_stock" as const, recordedAt: "2026-08-01T00:00:00.000Z" },
    { listingId: listing.id, priceCents: 6_100 + index * 100, shippingCents: 500, shippingKnown: true, stockStatus: "in_stock" as const, recordedAt: "2026-09-01T10:00:00.000Z" },
    { listingId: listing.id, priceCents: 6_100 + index * 100, shippingCents: 500, shippingKnown: true, stockStatus: "out_of_stock" as const, recordedAt: "2026-09-01T14:00:00.000Z" },
  ]);
  return { sets: [{ id: "set-1", releaseDate: "2026-01-01" }], products, listings, history, signals: [], monitorRuns: Array.from({ length: 20 }, (_, index) => ({ sourceKey: "monitor", status: "completed", startedAt: `2026-09-${String(index % 10 + 1).padStart(2, "0")}T00:00:00Z` })), monitoredStores: 6 };
}

describe("set market intelligence composition", () => {
  it("derives demand, stock cycles, coverage, and inferred supply without conflating hype", () => {
    const result = calculateSetMarketIntelligence(dataset(), "set-1", now);
    expect(result.demand.derivedScore).not.toBeNull();
    expect(result.demand.coverage).toMatchObject({ monitoredStores: 6, storesWithSet: 4, storesInStock: 4, productsObserved: 4, monitorRuns30d: 20 });
    expect(result.demand.restocks30d).toBe(8);
    expect(result.demand.selloutCycles).toBe(4);
    expect(result.demand.medianSelloutHours).toBe(4);
    expect(result.hype.score).toBeNull();
    expect(result.reprint.possibleSupplyExpansion).toBe(true);
    expect(result.reprint.confirmedReprint).toBe(false);
  });

  it("keeps a manual demand override and its derived value visible", () => {
    const input = dataset();
    input.signals.push({ id: "manual", setId: "set-1", signalType: "manual_demand", sourceType: "manual", sourceKey: "private", value: 22, confidence: "MEDIUM", observedAt: now.toISOString(), sampleSize: null, note: null, confirmedReprint: false, reprintStatus: null, announcementDate: null, expectedSupplyDate: null });
    const result = calculateSetMarketIntelligence(input, "set-1", now);
    expect(result.demand.score).toBe(22);
    expect(result.demand.manualScore).toBe(22);
    expect(result.demand.derivedScore).not.toBe(22);
    expect(result.demand.sourceType).toBe("manual");
  });

  it("feeds only sufficiently confident normalized metrics into Set Investment", () => {
    const result = calculateSetMarketIntelligence(dataset(), "set-1", now);
    const signals = marketIntelligenceToSetMetricSignals(result);
    expect(signals.metrics.demand).toBe(result.demand.score);
    expect(signals.metrics.hype).toBeUndefined();
    expect(signals.provenance.demand?.sourceNote).toContain("reposiciones");
  });

  it("keeps official confirmation separate from inferred expansion", () => {
    const input = dataset();
    input.signals.push({ id: "official", setId: "set-1", signalType: "official_reprint_announced", sourceType: "official", sourceKey: "manufacturer", value: 90, confidence: "HIGH", observedAt: now.toISOString(), sampleSize: null, note: "Announcement", confirmedReprint: true, reprintStatus: "CONFIRMED_REPRINT", announcementDate: "2026-09-13", expectedSupplyDate: null });
    const result = calculateSetMarketIntelligence(input, "set-1", now);
    expect(result.reprint).toMatchObject({ confirmedReprint: true, status: "CONFIRMED_REPRINT", confidence: "HIGH", sourceType: "official" });
    expect(result.reprint.confirmedSignals).toHaveLength(1);
  });

  it("preserves manual reprint value and confidence ahead of internal inference", () => {
    const input = dataset();
    input.signals.push({ id: "manual-risk", setId: "set-1", signalType: "manual_reprint_risk", sourceType: "manual", sourceKey: "private", value: 25, confidence: "HIGH", observedAt: now.toISOString(), sampleSize: null, note: null, confirmedReprint: false, reprintStatus: "LOW_RISK", announcementDate: null, expectedSupplyDate: null });
    const result = calculateSetMarketIntelligence(input, "set-1", now);
    expect(result.reprint).toMatchObject({ risk: 25, manualRisk: 25, confidence: "HIGH", sourceType: "manual", status: "LOW_RISK" });
    expect(result.reprint.derivedRisk).not.toBe(25);
  });
});
