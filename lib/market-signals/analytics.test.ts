import { describe, expect, it } from "vitest";
import {
  aggregateHypeSignals,
  applyHypeDecay,
  calculateAvailabilityContraction,
  calculateAvailabilityExpansion,
  calculateAvailabilityTrend,
  calculateBroadRestockStoreCount,
  calculateDemandConfidence,
  calculateDemandScore,
  calculateDecayedHypeValue,
  calculateHypeMomentum,
  calculateMedianSelloutTime,
  calculateReprintConfidence,
  calculateReprintRisk,
  calculateReprintSafety,
  calculateRestockEvents,
  calculateSelloutCycles,
  calculateSelloutConfidence,
  calculateSelloutEvents,
  calculateStockTransitions,
  classifyReprintStatus,
  resolveEffectiveMarketMetric,
} from "./analytics";
import type { DemandComponents, MarketSignalObservation, StockObservation } from "./types";

const now = new Date("2026-09-13T12:00:00.000Z");
const stock = (listingId: string, storeId: string, status: StockObservation["stockStatus"], observedAt: string, productId = "product-1"): StockObservation => ({ listingId, productId, storeId, stockStatus: status, observedAt });
const signal = (partial: Partial<MarketSignalObservation> = {}): MarketSignalObservation => ({ id: "signal-1", setId: "set-1", signalType: "manual_hype", sourceType: "manual", sourceKey: "manual", value: 80, confidence: "MEDIUM", observedAt: "2026-09-13T10:00:00.000Z", sampleSize: null, note: null, confirmedReprint: false, reprintStatus: null, announcementDate: null, expectedSupplyDate: null, ...partial });

describe("stock-transition market analytics", () => {
  it("does not turn repeated in-stock observations into restocks", () => {
    const values = [stock("l1", "s1", "in_stock", "2026-09-01T00:00:00Z"), stock("l1", "s1", "in_stock", "2026-09-02T00:00:00Z")];
    expect(calculateRestockEvents(values)).toHaveLength(0);
  });

  it("detects out-of-stock to in-stock as one restock", () => {
    const values = [stock("l1", "s1", "out_of_stock", "2026-09-01T00:00:00Z"), stock("l1", "s1", "in_stock", "2026-09-02T00:00:00Z"), stock("l1", "s1", "in_stock", "2026-09-03T00:00:00Z")];
    expect(calculateRestockEvents(values)).toHaveLength(1);
  });

  it("detects in-stock to out-of-stock as a sellout", () => {
    expect(calculateSelloutEvents([stock("l1", "s1", "in_stock", "2026-09-01T00:00:00Z"), stock("l1", "s1", "out_of_stock", "2026-09-02T00:00:00Z")])).toHaveLength(1);
  });

  it("separates preorder release transitions from restocks", () => {
    const transitions = calculateStockTransitions([stock("l1", "s1", "preorder", "2026-09-01T00:00:00Z"), stock("l1", "s1", "in_stock", "2026-09-02T00:00:00Z")]);
    expect(transitions).toHaveLength(1);
    expect(transitions[0].transitionType).toBe("RELEASE");
    expect(calculateRestockEvents([stock("l1", "s1", "preorder", "2026-09-01T00:00:00Z"), stock("l1", "s1", "in_stock", "2026-09-02T00:00:00Z")])).toHaveLength(0);
  });

  it("measures fast and slow completed restock cycles", () => {
    const values = [
      stock("l1", "s1", "out_of_stock", "2026-09-01T00:00:00Z"), stock("l1", "s1", "in_stock", "2026-09-01T10:00:00Z"), stock("l1", "s1", "out_of_stock", "2026-09-01T14:00:00Z"),
      stock("l2", "s2", "out_of_stock", "2026-09-01T00:00:00Z"), stock("l2", "s2", "in_stock", "2026-09-02T00:00:00Z"), stock("l2", "s2", "out_of_stock", "2026-09-07T00:00:00Z"),
    ];
    const cycles = calculateSelloutCycles(values);
    expect(cycles.map((cycle) => cycle.durationHours)).toEqual([4, 120]);
    expect(calculateMedianSelloutTime(cycles)).toBe(62);
  });

  it("calculates shrinking and expanding availability only with a valid baseline", () => {
    expect(calculateAvailabilityContraction(2, 4)).toBe(50);
    expect(calculateAvailabilityExpansion(6, 4)).toBe(50);
    expect(calculateAvailabilityContraction(1, 0)).toBeNull();
  });

  it("compares only listings observed both now and in the past", () => {
    const observations = [
      stock("l1", "s1", "in_stock", "2026-08-01T00:00:00Z"), stock("l1", "s1", "out_of_stock", "2026-09-10T00:00:00Z"),
      stock("l2", "s2", "in_stock", "2026-08-01T00:00:00Z"), stock("l2", "s2", "in_stock", "2026-09-10T00:00:00Z"),
      stock("new", "s3", "in_stock", "2026-09-12T00:00:00Z"),
    ];
    expect(calculateAvailabilityTrend(observations, now, 30)).toMatchObject({ current: 1, previous: 2, comparableListings: 2, changePercent: -50, contractionScore: 50 });
  });

  it("finds broad restocks across multiple stores without counting repeated runs", () => {
    const observations = [stock("l1", "s1", "out_of_stock", "2026-09-10T00:00:00Z"), stock("l1", "s1", "in_stock", "2026-09-11T00:00:00Z"), stock("l2", "s2", "out_of_stock", "2026-09-10T00:00:00Z"), stock("l2", "s2", "in_stock", "2026-09-11T02:00:00Z")];
    expect(calculateBroadRestockStoreCount(calculateRestockEvents(observations))).toBe(2);
  });

  it("grades sellout confidence from cycle, store, product, and monitor coverage", () => {
    expect(calculateSelloutConfidence({ cycles: 7, stores: 4, products: 4, monitorRuns30d: 25 })).toBe("HIGH");
    expect(calculateSelloutConfidence({ cycles: 3, stores: 2, products: 2, monitorRuns30d: 8 })).toBe("MEDIUM");
    expect(calculateSelloutConfidence({ cycles: 1, stores: 1, products: 1, monitorRuns30d: 2 })).toBe("LOW");
    expect(calculateSelloutConfidence({ cycles: 0, stores: 4, products: 4, monitorRuns30d: 25 })).toBe("INSUFFICIENT");
  });
});

describe("demand intelligence", () => {
  const strong: DemandComponents = { selloutSpeed: 90, availabilityContraction: 80, restockActivity: 75, sealedPriceMomentum: 70, inStockPressure: 80 };

  it("combines stock pressure, transitions and limited price momentum deterministically", () => {
    expect(calculateDemandScore({ components: strong, behavioralEvidence: true })).toBe(81);
    expect(calculateDemandScore({ components: strong, behavioralEvidence: true })).toBe(81);
  });

  it("does not make price momentum alone equal maximum demand", () => {
    expect(calculateDemandScore({ components: { selloutSpeed: null, availabilityContraction: null, restockActivity: null, sealedPriceMomentum: 100, inStockPressure: null }, behavioralEvidence: false })).toBe(60);
  });

  it("does not equate scarcity without buyer evidence to maximum demand", () => {
    expect(calculateDemandScore({ components: { selloutSpeed: null, availabilityContraction: null, restockActivity: 20, sealedPriceMomentum: null, inStockPressure: 100 }, behavioralEvidence: false })).toBeLessThanOrEqual(60);
  });

  it("keeps single-store confidence low and supports all confidence bands", () => {
    expect(calculateDemandConfidence({ stores: 1, products: 6, historyDays: 90, transitions: 10, priceObservations: 20 })).toBe("LOW");
    expect(calculateDemandConfidence({ stores: 5, products: 6, historyDays: 45, transitions: 8, priceObservations: 20 })).toBe("HIGH");
    expect(calculateDemandConfidence({ stores: 2, products: 2, historyDays: 30, transitions: 2, priceObservations: 4 })).toBe("MEDIUM");
    expect(calculateDemandConfidence({ stores: 0, products: 1, historyDays: 0, transitions: 0, priceObservations: 0 })).toBe("INSUFFICIENT");
  });

  it("combines rising prices with stock pressure more strongly than weak signals", () => {
    const rising = calculateDemandScore({ components: { selloutSpeed: 80, availabilityContraction: 70, restockActivity: 75, sealedPriceMomentum: 80, inStockPressure: 85 }, behavioralEvidence: true });
    const weak = calculateDemandScore({ components: { selloutSpeed: 40, availabilityContraction: 0, restockActivity: 20, sealedPriceMomentum: 35, inStockPressure: 20 }, behavioralEvidence: true });
    expect(rising!).toBeGreaterThan(weak! + 40);
  });
});

describe("hype intelligence", () => {
  it("supports one manual observation without inventing a trend", () => {
    expect(aggregateHypeSignals([signal()], now)).toMatchObject({ score: 80, confidence: "MEDIUM", sourceCount: 1 });
    expect(calculateHypeMomentum([signal()])).toBe("INSUFFICIENT");
  });

  it("exposes high, low, and insufficient hype confidence", () => {
    const high = [signal({ id: "official", signalType: "external_hype", sourceType: "official", sourceKey: "official", confidence: "HIGH" }), signal({ id: "external", signalType: "external_hype", sourceType: "external", sourceKey: "external", confidence: "HIGH" }), signal({ id: "manual", sourceKey: "manual", confidence: "MEDIUM" })];
    expect(aggregateHypeSignals(high, now).confidence).toBe("HIGH");
    expect(aggregateHypeSignals([signal({ confidence: "LOW" })], now).confidence).toBe("LOW");
    expect(aggregateHypeSignals([], now).confidence).toBe("INSUFFICIENT");
  });

  it("aggregates multiple independent sources", () => {
    const result = aggregateHypeSignals([signal(), signal({ id: "s2", sourceType: "external", sourceKey: "provider", value: 60, confidence: "HIGH" })], now);
    expect(result.score).toBeGreaterThan(60);
    expect(result.score).toBeLessThan(80);
    expect(result.confidence).toBe("MEDIUM");
  });

  it("accepts provider weights without making any provider mandatory", () => {
    const signals = [signal({ sourceKey: "source-a", value: 90 }), signal({ id: "s2", sourceType: "external", sourceKey: "source-b", value: 30 })];
    expect(aggregateHypeSignals(signals, now, { "source-a": 200, "source-b": 50 }).score).toBeGreaterThan(aggregateHypeSignals(signals, now).score!);
  });

  it("decays old hype without deleting it", () => {
    expect(applyHypeDecay("2026-09-13T12:00:00Z", now)).toBe(1);
    expect(applyHypeDecay("2026-07-30T12:00:00Z", now)).toBeCloseTo(0.5, 1);
    expect(calculateDecayedHypeValue(100, "2026-07-30T12:00:00Z", now)).toBe(75);
  });

  it("detects rising, falling, and stable hype", () => {
    const series = (values: number[]) => values.map((value, index) => signal({ id: `s${index}`, sourceKey: `s${index}`, value, observedAt: `2026-0${index + 5}-01T00:00:00Z` }));
    expect(calculateHypeMomentum(series([40, 55, 75]))).toBe("RISING");
    expect(calculateHypeMomentum(series([80, 65, 40]))).toBe("FALLING");
    expect(calculateHypeMomentum(series([60, 62, 61]))).toBe("STABLE");
  });

  it("allows high hype while demand remains low", () => {
    expect(aggregateHypeSignals([signal({ value: 95 })], now).score).toBe(95);
    expect(calculateDemandScore({ components: { selloutSpeed: null, availabilityContraction: 0, restockActivity: 20, sealedPriceMomentum: 30, inStockPressure: 10 }, behavioralEvidence: true })).toBeLessThan(40);
  });
});

describe("reprint intelligence", () => {
  it("marks an explicit confirmed reprint as high risk and confirmed", () => {
    const confirmed = signal({ signalType: "official_reprint_announced", sourceType: "official", value: 85, confidence: "HIGH", confirmedReprint: true });
    const result = calculateReprintRisk({ signals: [confirmed], availabilityExpansionScore: null, broadRestockStores: 0, sealedPriceMomentum: null, releaseDate: null, now });
    expect(result.risk).toBeGreaterThanOrEqual(90);
    expect(classifyReprintStatus(result.risk, result.confirmed)).toBe("CONFIRMED_REPRINT");
    expect(calculateReprintConfidence({ confirmed: true, explicitSignals: 1, stores: 0, broadRestockStores: 0, historyDays: 0, inferredEvidence: false })).toBe("HIGH");
  });

  it("does not call one store restock a confirmed reprint", () => {
    const result = calculateReprintRisk({ signals: [], availabilityExpansionScore: 10, broadRestockStores: 1, sealedPriceMomentum: 50, releaseDate: "2025-01-01", now });
    expect(result.confirmed).toBe(false);
    expect(classifyReprintStatus(result.risk, false)).not.toBe("CONFIRMED_REPRINT");
  });

  it("supports medium and low inferred reprint confidence", () => {
    expect(calculateReprintConfidence({ confirmed: false, explicitSignals: 2, stores: 1, broadRestockStores: 0, historyDays: 0, inferredEvidence: false })).toBe("MEDIUM");
    expect(calculateReprintConfidence({ confirmed: false, explicitSignals: 0, stores: 2, broadRestockStores: 1, historyDays: 14, inferredEvidence: true })).toBe("LOW");
  });

  it("raises inferred risk for a broad simultaneous restock and expansion", () => {
    const weak = calculateReprintRisk({ signals: [], availabilityExpansionScore: 0, broadRestockStores: 0, sealedPriceMomentum: 60, releaseDate: "2024-01-01", now });
    const broad = calculateReprintRisk({ signals: [], availabilityExpansionScore: 90, broadRestockStores: 4, sealedPriceMomentum: 30, releaseDate: "2024-01-01", now });
    expect(broad.risk!).toBeGreaterThan(weak.risk!);
    expect(broad.confirmed).toBe(false);
  });

  it("keeps an old set low-risk with insufficient confidence when supply evidence is absent", () => {
    const result = calculateReprintRisk({ signals: [], availabilityExpansionScore: null, broadRestockStores: 0, sealedPriceMomentum: null, releaseDate: "2019-01-01", now });
    expect(result.risk).toBe(15);
    expect(classifyReprintStatus(result.risk, false)).toBe("LOW_RISK");
    expect(calculateReprintConfidence({ confirmed: false, explicitSignals: 0, stores: 0, broadRestockStores: 0, historyDays: 90, inferredEvidence: false })).toBe("INSUFFICIENT");
  });

  it("treats a new set with broad supply as higher risk", () => {
    const result = calculateReprintRisk({ signals: [], availabilityExpansionScore: 80, broadRestockStores: 3, sealedPriceMomentum: 35, releaseDate: "2026-08-01", now });
    expect(result.risk).toBeGreaterThanOrEqual(65);
  });

  it("uses the latest manual risk as an override", () => {
    const result = calculateReprintRisk({ signals: [signal({ id: "old", signalType: "manual_reprint_risk", value: 20, observedAt: "2026-01-01T00:00:00Z" }), signal({ id: "new", signalType: "manual_reprint_risk", value: 77, observedAt: "2026-09-01T00:00:00Z" })], availabilityExpansionScore: 5, broadRestockStores: 0, sealedPriceMomentum: 80, releaseDate: "2020-01-01", now });
    expect(result.risk).toBe(77);
    expect(result.manualRisk).toBe(77);
  });

  it("calculates reprint safety as the exact inverse", () => {
    expect(calculateReprintSafety(80)).toBe(20);
    expect(calculateReprintSafety(20)).toBe(80);
  });

  it("keeps manual, official, and internal precedence explicit", () => {
    expect(resolveEffectiveMarketMetric({ manual: { value: 90, confidence: "LOW" }, official: { value: 80, confidence: "HIGH" }, internal: { value: 70, confidence: "HIGH" } })).toMatchObject({ value: 90, sourceType: "manual" });
    expect(resolveEffectiveMarketMetric({ manual: null, official: { value: 80, confidence: "HIGH" }, internal: { value: 70, confidence: "HIGH" } })).toMatchObject({ value: 80, sourceType: "official" });
    expect(resolveEffectiveMarketMetric({ manual: null, official: null, internal: { value: 70, confidence: "MEDIUM" } })).toMatchObject({ value: 70, sourceType: "derived" });
  });

  it("supports high demand with low scarcity as independent values", () => {
    const demand = calculateDemandScore({ components: { selloutSpeed: 90, availabilityContraction: 20, restockActivity: 90, sealedPriceMomentum: 75, inStockPressure: 20 }, behavioralEvidence: true });
    const scarcity = 15;
    expect(demand).toBeGreaterThan(60);
    expect(scarcity).toBeLessThan(20);
  });
});
