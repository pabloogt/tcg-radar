import { describe, expect, it } from "vitest";
import { aggregatePullRateSources, calculateExpectedHitsPerBox, calculateHitFrequencyScore, calculateOpeningDemandPotential, calculatePacksPerHit, calculateProbabilityFromPacks, calculatePullConfidence, calculatePullRateAttractiveness, calculatePullRateEV, calculateSetPullAnalytics, calculateTopChaseDifficulty, detectPullRateConflict, normalizePullProbability, validateProbabilityHierarchy } from "./analytics";
import { pullRateProfile } from "./config";
import type { PullRateObservation } from "./types";
import { pullAnalyticsToSetMetricSignals } from "./service";
import { resolveEffectiveInvestmentMetric } from "@/lib/investment/provider";

const NOW = new Date("2026-09-13T12:00:00.000Z");
const rate = (overrides: Partial<PullRateObservation> = {}): PullRateObservation => ({
  id: "rate-1", setId: "set-1", cardId: null, category: "High rarity", categoryGroup: "HIGH_RARITY_HIT", subcategory: null,
  oddsNumerator: 1, oddsDenominator: 12, probabilityPpm: 83_333, sampleSize: 10_000, source: "community-a", sourceType: "community", reportedConfidence: null,
  sourceNote: null, outcomeGroup: null, mutuallyExclusive: false, observedAt: NOW.toISOString(), ...overrides,
});
const strongCards = { chaseStrength: 90, chaseDepth: 88, cardValue: 86, chaseConcentration: 35 };

describe("pull-rate probability and analytics", () => {
  it.each([[1, 10, 100_000], [1, 100, 10_000], [1, 1_000, 1_000]])("normalizes %i/%i", (numerator, denominator, expected) => {
    expect(normalizePullProbability({ oddsNumerator: numerator, oddsDenominator: denominator })).toBe(expected);
  });

  it("converts probability and packs per hit in both directions", () => {
    expect(calculatePacksPerHit(100_000)).toBe(10_000);
    expect(calculatePacksPerHit(20_000)).toBe(50_000);
    expect(calculateProbabilityFromPacks(1_000_000)).toBe(1_000);
  });

  it("rejects zero, invalid and impossible probability inputs", () => {
    expect(normalizePullProbability({ oddsNumerator: 1, oddsDenominator: 0 })).toBeNull();
    expect(normalizePullProbability({ oddsNumerator: 2, oddsDenominator: 1 })).toBeNull();
    expect(calculatePacksPerHit(0)).toBeNull();
    expect(normalizePullProbability({ oddsNumerator: 1, oddsDenominator: 2_000_000 })).toBeNull();
  });

  it("uses sample-weighted aggregation for consistent sources", () => {
    const result = aggregatePullRateSources([rate({ probabilityPpm: 40_000, sampleSize: 1_000 }), rate({ id: "b", source: "community-b", probabilityPpm: 30_000, sampleSize: 3_000 })], "pokemon", NOW);
    expect(result).toMatchObject({ probabilityPpm: 32_500, sourceConflict: false, sampleSize: 4_000 });
  });

  it("uses a robust median and lowers confidence for conflicting sources", () => {
    const observations = [rate({ probabilityPpm: 40_000 }), rate({ id: "b", source: "b", probabilityPpm: 10_000 }), rate({ id: "c", source: "c", probabilityPpm: 11_000 })];
    const result = aggregatePullRateSources(observations, "pokemon", NOW);
    expect(result).toMatchObject({ probabilityPpm: 11_000, sourceConflict: true });
    expect(result?.confidence).not.toBe("HIGH");
  });

  it("detects materially conflicting sources", () => {
    expect(detectPullRateConflict([40_000, 10_000], pullRateProfile("pokemon"))).toBe(true);
    expect(detectPullRateConflict([33_000, 30_000], pullRateProfile("pokemon"))).toBe(false);
  });

  it("gives official disclosure high confidence", () => {
    expect(calculatePullConfidence({ observations: [rate({ sourceType: "official", sampleSize: null })], sourceConflict: false, tcg: "pokemon", now: NOW })).toBe("HIGH");
  });

  it("distinguishes large and small community samples", () => {
    const large = calculatePullConfidence({ observations: [rate({ sampleSize: 20_000 })], sourceConflict: false, tcg: "pokemon", now: NOW });
    const small = calculatePullConfidence({ observations: [rate({ sampleSize: 100 })], sourceConflict: false, tcg: "pokemon", now: NOW });
    expect(large).toBe("HIGH"); expect(small).toBe("LOW");
  });

  it("returns insufficient confidence without data", () => {
    expect(calculatePullConfidence({ observations: [], sourceConflict: false, tcg: "pokemon" })).toBe("INSUFFICIENT");
  });

  it("maps easy, moderate and extreme chase difficulty monotonically", () => {
    const easy = calculateTopChaseDifficulty(10_000, "pokemon")!; const moderate = calculateTopChaseDifficulty(300_000, "pokemon")!; const extreme = calculateTopChaseDifficulty(5_000_000, "pokemon")!;
    expect(easy).toBeLessThan(moderate); expect(moderate).toBeLessThan(extreme);
  });

  it("rewards balanced hit frequency over constant or punishing hits", () => {
    const balanced = calculateHitFrequencyScore(8_000, "pokemon")!;
    expect(balanced).toBeGreaterThan(calculateHitFrequencyScore(1_000, "pokemon")!);
    expect(balanced).toBeGreaterThan(calculateHitFrequencyScore(100_000, "pokemon")!);
  });

  it("scores balanced pulls with strong deep chases highly", () => {
    expect(calculatePullRateAttractiveness({ hitFrequencyScore: 95, topChaseDifficulty: 70, crossSignals: strongCards, tcg: "pokemon" })!).toBeGreaterThan(85);
  });

  it("does not make easy pulls plus weak cards exceptional", () => {
    expect(calculatePullRateAttractiveness({ hitFrequencyScore: 55, topChaseDifficulty: 10, crossSignals: { chaseStrength: 25, chaseDepth: 20, cardValue: 20, chaseConcentration: 20 }, tcg: "pokemon" })!).toBeLessThan(50);
  });

  it("penalizes very hard pulls with weak card fundamentals", () => {
    expect(calculatePullRateAttractiveness({ hitFrequencyScore: 45, topChaseDifficulty: 95, crossSignals: { chaseStrength: 30, chaseDepth: 20, cardValue: 20, chaseConcentration: 40 }, tcg: "pokemon" })!).toBeLessThan(50);
  });

  it("rewards hard pulls when strong and deep chase cards support them", () => {
    expect(calculatePullRateAttractiveness({ hitFrequencyScore: 80, topChaseDifficulty: 88, crossSignals: strongCards, tcg: "pokemon" })!).toBeGreaterThan(80);
  });

  it("penalizes a jackpot-only set", () => {
    const distributed = calculatePullRateAttractiveness({ hitFrequencyScore: 80, topChaseDifficulty: 88, crossSignals: strongCards, tcg: "pokemon" })!;
    const jackpot = calculatePullRateAttractiveness({ hitFrequencyScore: 80, topChaseDifficulty: 88, crossSignals: { ...strongCards, chaseDepth: 30, chaseConcentration: 95 }, tcg: "pokemon" })!;
    expect(jackpot).toBeLessThan(distributed - 15);
  });

  it("calculates opening-demand potential independently", () => {
    expect(calculateOpeningDemandPotential({ hitFrequencyScore: 90, topChaseDifficulty: 70, crossSignals: strongCards, tcg: "pokemon" })!).toBeGreaterThan(80);
  });

  it("calculates fractional expected hits only when box size is known", () => {
    expect(calculateExpectedHitsPerBox(83_333, 36)).toBe(3_000);
    expect(calculateExpectedHitsPerBox(20_000, 36)).toBe(720);
    expect(calculateExpectedHitsPerBox(20_000, null)).toBeNull();
  });

  it("calculates EV only for explicit mutually exclusive outcomes", () => {
    const result = calculatePullRateEV([{ probabilityPpm: 100_000, valueCents: 10_000, outcomeGroup: "slot", mutuallyExclusive: true }, { probabilityPpm: 50_000, valueCents: 20_000, outcomeGroup: "slot", mutuallyExclusive: true }]);
    expect(result).toMatchObject({ valueCents: 2_000, confidence: "LOW" });
    expect(calculatePullRateEV([{ probabilityPpm: 100_000, valueCents: 10_000, outcomeGroup: null, mutuallyExclusive: false }]).valueCents).toBeNull();
  });

  it("detects hierarchy inconsistencies", () => {
    const analytics = calculateSetPullAnalytics({ setId: "set-1", tcg: "pokemon", observations: [rate({ categoryGroup: "HIGH_RARITY_HIT", probabilityPpm: 20_000 }), rate({ id: "top", category: "Top tier", categoryGroup: "CHASE_TIER", probabilityPpm: 100_000, source: "other" })], crossSignals: strongCards, now: NOW });
    expect(validateProbabilityHierarchy(analytics.rates)).toBe(false);
    expect(analytics.warnings).toContain("probability_inconsistency");
  });

  it("exposes full, partial and insufficient completeness", () => {
    const fullRates = [rate({ categoryGroup: "ANY_HIT", category: "Any" }), rate({ id: "h", categoryGroup: "HIGH_RARITY_HIT", category: "High", source: "h" }), rate({ id: "t", categoryGroup: "CHASE_TIER", category: "Tier", source: "t" }), rate({ id: "c", categoryGroup: "TOP_CHASE", category: "Chase", source: "c" })];
    const full = calculateSetPullAnalytics({ setId: "set-1", tcg: "pokemon", observations: fullRates, crossSignals: strongCards, now: NOW });
    const partial = calculateSetPullAnalytics({ setId: "set-1", tcg: "pokemon", observations: [rate()], crossSignals: strongCards, now: NOW });
    const empty = calculateSetPullAnalytics({ setId: "set-1", tcg: "pokemon", observations: [], crossSignals: strongCards, now: NOW });
    expect(full.pullDataCompleteness).toBe(100); expect(partial.pullDataCompleteness).toBeGreaterThan(0); expect(empty.confidence).toBe("INSUFFICIENT");
  });

  it("calculates set rates, box expectations and preliminary state", () => {
    const result = calculateSetPullAnalytics({ setId: "set-1", tcg: "pokemon", observations: [rate({ categoryGroup: "ANY_HIT", category: "Any hit", probabilityPpm: 200_000, sampleSize: 100 }), rate({ id: "top", categoryGroup: "TOP_CHASE", category: "Top chase", probabilityPpm: 1_000, sampleSize: 100, source: "top" })], crossSignals: strongCards, packsPerBoosterBox: 36, now: NOW });
    expect(result.expectedHitsPerBoxMilli).toBe(7_200); expect(result.expectedTopChaseHitsPerBoxMilli).toBe(36); expect(result.dataState).toBe("PRELIMINARY"); expect(result.warnings).toContain("low_sample_size");
  });

  it("is deterministic", () => {
    const input = { setId: "set-1", tcg: "pokemon", observations: [rate()], crossSignals: strongCards, now: NOW };
    expect(calculateSetPullAnalytics(input)).toEqual(calculateSetPullAnalytics(input));
  });

  it("keeps the derived pull metric visible while a manual override wins", () => {
    const observations = [rate({ categoryGroup: "ANY_HIT", category: "Any" }), rate({ id: "h", categoryGroup: "HIGH_RARITY_HIT", category: "High", source: "h" }), rate({ id: "t", categoryGroup: "CHASE_TIER", category: "Tier", source: "t" }), rate({ id: "c", categoryGroup: "TOP_CHASE", category: "Chase", source: "c" })];
    const analytics = calculateSetPullAnalytics({ setId: "set-1", tcg: "pokemon", observations, crossSignals: strongCards, now: NOW }); const derived = pullAnalyticsToSetMetricSignals(analytics);
    expect(derived.metrics.pullRateAttractiveness).toBeTypeOf("number");
    expect(resolveEffectiveInvestmentMetric(93, [{ value: derived.metrics.pullRateAttractiveness, provenance: derived.provenance.pullRateAttractiveness }])).toMatchObject({ value: 93, source: "manual" });
    expect(resolveEffectiveInvestmentMetric(null, [{ value: derived.metrics.pullRateAttractiveness, provenance: derived.provenance.pullRateAttractiveness }])).toMatchObject({ value: derived.metrics.pullRateAttractiveness, source: "derived" });
  });
});
