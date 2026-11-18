import { PULL_SOURCE_BASE_CONFIDENCE, pullRateProfile, type PullRateScoringProfile, type PullScoreAnchor } from "./config";
import type { AggregatedPullRate, PullDataState, PullRateConfidence, PullRateCrossSignals, PullRateObservation, PullRateWarning, SetPullRateAnalytics } from "./types";

const DAY_MS = 86_400_000;
const PPM = 1_000_000;
const clampScore = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

function interpolate(value: number, anchors: readonly PullScoreAnchor[]): number {
  if (value <= anchors[0][0]) return anchors[0][1];
  if (value >= anchors.at(-1)![0]) return anchors.at(-1)![1];
  for (let index = 1; index < anchors.length; index += 1) {
    const left = anchors[index - 1]; const right = anchors[index];
    if (value <= right[0]) return Math.round(left[1] + ((value - left[0]) * (right[1] - left[1])) / (right[0] - left[0]));
  }
  return anchors.at(-1)![1];
}

function median(values: readonly number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b); const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

export function normalizePullProbability(input: { oddsNumerator?: number | null; oddsDenominator?: number | null; probabilityPpm?: number | null; packsPerHitMilli?: number | null }): number | null {
  if (input.probabilityPpm !== null && input.probabilityPpm !== undefined) return Number.isInteger(input.probabilityPpm) && input.probabilityPpm > 0 && input.probabilityPpm <= PPM ? input.probabilityPpm : null;
  if (input.oddsNumerator !== null && input.oddsNumerator !== undefined || input.oddsDenominator !== null && input.oddsDenominator !== undefined) {
    const numerator = input.oddsNumerator; const denominator = input.oddsDenominator;
    if (!Number.isInteger(numerator) || !Number.isInteger(denominator) || !numerator || !denominator || numerator < 0 || denominator < numerator) return null;
    if (numerator * PPM < denominator) return null;
    return Math.round((numerator * PPM) / denominator);
  }
  if (input.packsPerHitMilli !== null && input.packsPerHitMilli !== undefined) return calculateProbabilityFromPacks(input.packsPerHitMilli);
  return null;
}

export function calculatePacksPerHit(probabilityPpm: number | null): number | null {
  if (!probabilityPpm || !Number.isInteger(probabilityPpm) || probabilityPpm < 1 || probabilityPpm > PPM) return null;
  return Math.round(1_000_000_000 / probabilityPpm);
}

export function calculateProbabilityFromPacks(packsPerHitMilli: number | null): number | null {
  if (!packsPerHitMilli || !Number.isInteger(packsPerHitMilli) || packsPerHitMilli < 1) return null;
  const normalized = Math.round(1_000_000_000 / packsPerHitMilli); return normalized >= 1 ? Math.min(PPM, normalized) : null;
}

export function detectPullRateConflict(probabilitiesPpm: readonly number[], profile: PullRateScoringProfile): boolean {
  const valid = probabilitiesPpm.filter((value) => Number.isInteger(value) && value > 0).sort((a, b) => a - b);
  if (valid.length < 2) return false;
  return Math.round((valid.at(-1)! * 10_000) / valid[0]) >= profile.conflictRatioBps;
}

function reportedConfidenceScore(confidence: PullRateObservation["reportedConfidence"]): number | null {
  return confidence === "HIGH" ? 90 : confidence === "MEDIUM" ? 68 : confidence === "LOW" ? 42 : null;
}

export function calculatePullConfidence(input: { observations: readonly PullRateObservation[]; sourceConflict: boolean; tcg: string; now?: Date }): PullRateConfidence {
  if (!input.observations.length) return "INSUFFICIENT";
  const profile = pullRateProfile(input.tcg); const now = input.now ?? new Date();
  let weightedScore = 0; let weightTotal = 0;
  for (const observation of input.observations) {
    const sourceBase = reportedConfidenceScore(observation.reportedConfidence) ?? PULL_SOURCE_BASE_CONFIDENCE[observation.sourceType];
    let sampleScore = observation.sourceType === "official" ? 95 : observation.sampleSize === null ? 35 : observation.sampleSize >= profile.communitySamples.high ? 95 : observation.sampleSize >= profile.communitySamples.medium ? 70 : observation.sampleSize >= 250 ? 48 : 25;
    if (observation.observedAt && now.getTime() - new Date(observation.observedAt).getTime() > profile.staleAfterDays * DAY_MS) sampleScore -= 15;
    const weight = Math.max(1, observation.sampleSize ?? (observation.sourceType === "official" ? profile.communitySamples.high : 1));
    weightedScore += (sourceBase * 65 + sampleScore * 35) * weight; weightTotal += weight;
  }
  let score = weightedScore / weightTotal / 100;
  if (input.sourceConflict) score -= 30;
  if (score >= 78) return "HIGH";
  if (score >= 60) return "MEDIUM";
  if (score >= 35) return "LOW";
  return "INSUFFICIENT";
}

export function aggregatePullRateSources(observations: readonly PullRateObservation[], tcg: string, now = new Date()): AggregatedPullRate | null {
  if (!observations.length) return null;
  const valid = observations.filter((entry) => Number.isInteger(entry.probabilityPpm) && entry.probabilityPpm > 0 && entry.probabilityPpm <= PPM);
  if (!valid.length) return null;
  const profile = pullRateProfile(tcg); const sourceConflict = detectPullRateConflict(valid.map((entry) => entry.probabilityPpm), profile);
  const withSamples = valid.filter((entry) => (entry.sampleSize ?? 0) > 0);
  const probabilityPpm = withSamples.length && !sourceConflict
    ? Math.round(withSamples.reduce((sum, entry) => sum + entry.probabilityPpm * entry.sampleSize!, 0) / withSamples.reduce((sum, entry) => sum + entry.sampleSize!, 0))
    : median(valid.map((entry) => entry.probabilityPpm))!;
  const first = valid[0]; const observed = valid.flatMap((entry) => entry.observedAt ? [entry.observedAt] : []).sort().at(-1) ?? null;
  return {
    identity: pullRateIdentity(first), category: first.category, categoryGroup: first.categoryGroup, subcategory: first.subcategory, cardId: first.cardId,
    probabilityPpm, packsPerHitMilli: calculatePacksPerHit(probabilityPpm)!,
    sampleSize: valid.some((entry) => entry.sampleSize !== null) ? valid.reduce((sum, entry) => sum + (entry.sampleSize ?? 0), 0) : null,
    sources: [...new Set(valid.map((entry) => entry.source))].sort(), confidence: calculatePullConfidence({ observations: valid, sourceConflict, tcg, now }), sourceConflict, observedAt: observed,
  };
}

export function pullRateIdentity(rate: Pick<PullRateObservation, "category" | "categoryGroup" | "subcategory" | "cardId">): string {
  const normalize = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").replace(/[^a-z0-9]+/g, " ").trim();
  return [rate.categoryGroup, normalize(rate.category), normalize(rate.subcategory ?? ""), rate.cardId ?? ""].join("|");
}

export function calculateTopChaseDifficulty(packsPerHitMilli: number | null, tcg: string): number | null {
  if (packsPerHitMilli === null) return null;
  return clampScore(interpolate(packsPerHitMilli / 1_000, pullRateProfile(tcg).chaseDifficultyPacks));
}

export function calculateHitFrequencyScore(packsPerHitMilli: number | null, tcg: string): number | null {
  if (packsPerHitMilli === null) return null;
  return clampScore(interpolate(packsPerHitMilli / 1_000, pullRateProfile(tcg).hitFrequencyPacks));
}

function weightedAvailable(entries: readonly { value: number | null; weight: number }[]): number | null {
  const available = entries.filter((entry): entry is { value: number; weight: number } => entry.value !== null);
  const totalWeight = available.reduce((sum, entry) => sum + entry.weight, 0);
  return totalWeight ? clampScore(available.reduce((sum, entry) => sum + entry.value * entry.weight, 0) / totalWeight) : null;
}

export function calculateOpeningDemandPotential(input: { hitFrequencyScore: number | null; topChaseDifficulty: number | null; crossSignals: PullRateCrossSignals; tcg: string }): number | null {
  const difficultyAppeal = input.topChaseDifficulty === null ? null : interpolate(input.topChaseDifficulty, pullRateProfile(input.tcg).difficultyAppeal);
  return weightedAvailable([{ value: input.hitFrequencyScore, weight: 35 }, { value: difficultyAppeal, weight: 20 }, { value: input.crossSignals.chaseStrength, weight: 20 }, { value: input.crossSignals.chaseDepth, weight: 15 }, { value: input.crossSignals.cardValue, weight: 10 }]);
}

export function calculatePullRateAttractiveness(input: { hitFrequencyScore: number | null; topChaseDifficulty: number | null; crossSignals: PullRateCrossSignals; tcg: string }): number | null {
  const difficultyAppeal = input.topChaseDifficulty === null ? null : interpolate(input.topChaseDifficulty, pullRateProfile(input.tcg).difficultyAppeal);
  let score = weightedAvailable([{ value: input.hitFrequencyScore, weight: 30 }, { value: difficultyAppeal, weight: 25 }, { value: input.crossSignals.chaseDepth, weight: 20 }, { value: input.crossSignals.cardValue, weight: 15 }, { value: input.crossSignals.chaseStrength, weight: 10 }]);
  if (score === null) return null;
  const cardAverage = weightedAvailable([{ value: input.crossSignals.chaseStrength, weight: 1 }, { value: input.crossSignals.chaseDepth, weight: 1 }, { value: input.crossSignals.cardValue, weight: 1 }]);
  if ((input.topChaseDifficulty ?? 0) >= 85 && (cardAverage ?? 0) < 50) score -= 18;
  if ((input.crossSignals.chaseConcentration ?? 0) >= 70) score -= Math.round(((input.crossSignals.chaseConcentration ?? 70) - 60) * 0.35);
  return clampScore(score);
}

export function calculatePullDataCompleteness(rates: readonly AggregatedPullRate[]): number {
  const groups = new Set(rates.map((rate) => rate.categoryGroup));
  const tierScore = (groups.has("ANY_HIT") ? 15 : 0) + (groups.has("HIGH_RARITY_HIT") ? 20 : 0) + (groups.has("CHASE_TIER") ? 20 : 0) + (groups.has("TOP_CHASE") || groups.has("SPECIFIC_CARD") ? 15 : 0);
  const sampled = rates.filter((rate) => rate.sampleSize !== null && rate.sampleSize > 0).length;
  const sampleScore = rates.length ? Math.round((sampled * 15) / rates.length) : 0;
  const confidenceScore = rates.length ? Math.round(rates.reduce((sum, rate) => sum + ({ HIGH: 15, MEDIUM: 11, LOW: 6, INSUFFICIENT: 0 }[rate.confidence]), 0) / rates.length) : 0;
  return Math.min(100, tierScore + sampleScore + confidenceScore);
}

export function calculateExpectedHitsPerBox(probabilityPpm: number | null, packsPerBox: number | null): number | null {
  if (probabilityPpm === null || packsPerBox === null || probabilityPpm < 0 || packsPerBox <= 0) return null;
  return Math.round((probabilityPpm * packsPerBox * 1_000) / PPM);
}

function representative(rates: readonly AggregatedPullRate[], groups: readonly string[], rarest = false): AggregatedPullRate | null {
  const selected = rates.filter((rate) => groups.includes(rate.categoryGroup));
  if (!selected.length) return null;
  return [...selected].sort((a, b) => rarest ? a.probabilityPpm - b.probabilityPpm : b.sampleSize === null ? -1 : a.sampleSize === null ? 1 : b.sampleSize - a.sampleSize || b.probabilityPpm - a.probabilityPpm)[0];
}

export function validateProbabilityHierarchy(rates: readonly AggregatedPullRate[]): boolean {
  const overall = representative(rates, ["ANY_HIT"]); const high = representative(rates, ["HIGH_RARITY_HIT"]); const top = representative(rates, ["CHASE_TIER"]); const chase = representative(rates, ["TOP_CHASE", "SPECIFIC_CARD"], true);
  return !((overall && high && high.probabilityPpm > overall.probabilityPpm) || (high && top && top.probabilityPpm > high.probabilityPpm) || (top && chase && chase.probabilityPpm > top.probabilityPpm));
}

export function calculatePullRateEV(outcomes: readonly { probabilityPpm: number; valueCents: number | null; outcomeGroup: string | null; mutuallyExclusive: boolean }[]): { valueCents: number | null; confidence: PullRateConfidence; reason: string | null } {
  if (!outcomes.length || outcomes.some((outcome) => !outcome.mutuallyExclusive || !outcome.outcomeGroup || outcome.valueCents === null || outcome.probabilityPpm <= 0)) return { valueCents: null, confidence: "INSUFFICIENT", reason: "Resultados solapados o precios incompletos." };
  const groups = new Set(outcomes.map((outcome) => outcome.outcomeGroup)); const totalProbability = outcomes.reduce((sum, outcome) => sum + outcome.probabilityPpm, 0);
  if (groups.size !== 1 || totalProbability > PPM) return { valueCents: null, confidence: "INSUFFICIENT", reason: "La estructura de probabilidades no es mutuamente exclusiva." };
  return { valueCents: Math.round(outcomes.reduce((sum, outcome) => sum + outcome.probabilityPpm * outcome.valueCents!, 0) / PPM), confidence: outcomes.length >= 5 ? "HIGH" : outcomes.length >= 3 ? "MEDIUM" : "LOW", reason: null };
}

export function getPullRateWarnings(input: { rates: readonly AggregatedPullRate[]; hierarchyValid: boolean; completeness: number; crossSignals: PullRateCrossSignals; now: Date; tcg: string }): PullRateWarning[] {
  const warnings = new Set<PullRateWarning>(); const profile = pullRateProfile(input.tcg);
  if (input.rates.some((rate) => rate.sourceConflict)) warnings.add("conflicting_sources");
  if (input.rates.some((rate) => rate.sampleSize !== null && rate.sampleSize < 250)) warnings.add("low_sample_size");
  if (input.rates.some((rate) => rate.observedAt && input.now.getTime() - new Date(rate.observedAt).getTime() > profile.staleAfterDays * DAY_MS)) warnings.add("stale_data");
  if (input.completeness < 70) warnings.add("incomplete_tiers");
  if (!input.hierarchyValid) warnings.add("probability_inconsistency");
  if (input.rates.some((rate) => rate.cardId) && input.crossSignals.cardValue === null) warnings.add("missing_card_prices");
  if ((input.crossSignals.chaseConcentration ?? 0) >= 70) warnings.add("high_jackpot_dependency");
  return [...warnings];
}

function aggregateByIdentity(observations: readonly PullRateObservation[], tcg: string, now: Date): AggregatedPullRate[] {
  const grouped = new Map<string, PullRateObservation[]>();
  for (const observation of observations) grouped.set(pullRateIdentity(observation), [...(grouped.get(pullRateIdentity(observation)) ?? []), observation]);
  return [...grouped.values()].flatMap((group) => { const aggregate = aggregatePullRateSources(group, tcg, now); return aggregate ? [aggregate] : []; }).sort((a, b) => a.categoryGroup.localeCompare(b.categoryGroup) || a.category.localeCompare(b.category));
}

function combinedConfidence(rates: readonly AggregatedPullRate[], completeness: number): PullRateConfidence {
  if (!rates.length || completeness < 25) return "INSUFFICIENT";
  const value = rates.reduce((sum, rate) => sum + ({ HIGH: 3, MEDIUM: 2, LOW: 1, INSUFFICIENT: 0 }[rate.confidence]), 0) / rates.length;
  if (completeness >= 80 && value >= 2.5) return "HIGH";
  if (completeness >= 60 && value >= 1.7) return "MEDIUM";
  if (completeness >= 35 && value >= 0.8) return "LOW";
  return "INSUFFICIENT";
}

export function calculateSetPullAnalytics(input: { setId: string; tcg: string; observations: readonly PullRateObservation[]; crossSignals?: Partial<PullRateCrossSignals>; packsPerBoosterBox?: number | null; now?: Date }): SetPullRateAnalytics {
  const now = input.now ?? new Date(); const rates = aggregateByIdentity(input.observations, input.tcg, now);
  const crossSignals: PullRateCrossSignals = { chaseStrength: input.crossSignals?.chaseStrength ?? null, chaseDepth: input.crossSignals?.chaseDepth ?? null, cardValue: input.crossSignals?.cardValue ?? null, chaseConcentration: input.crossSignals?.chaseConcentration ?? null };
  const overall = representative(rates, ["ANY_HIT"]); const high = representative(rates, ["HIGH_RARITY_HIT"]); const top = representative(rates, ["CHASE_TIER"]); const chase = representative(rates, ["TOP_CHASE", "SPECIFIC_CARD"], true);
  const hitFrequencyScore = calculateHitFrequencyScore(calculatePacksPerHit((high ?? overall)?.probabilityPpm ?? null), input.tcg);
  const topChaseDifficulty = calculateTopChaseDifficulty(calculatePacksPerHit((chase ?? top)?.probabilityPpm ?? null), input.tcg);
  const pullRateAttractiveness = calculatePullRateAttractiveness({ hitFrequencyScore, topChaseDifficulty, crossSignals, tcg: input.tcg });
  const openingDemandPotential = calculateOpeningDemandPotential({ hitFrequencyScore, topChaseDifficulty, crossSignals, tcg: input.tcg });
  const pullDataCompleteness = calculatePullDataCompleteness(rates); const hierarchyValid = validateProbabilityHierarchy(rates); const warnings = getPullRateWarnings({ rates, hierarchyValid, completeness: pullDataCompleteness, crossSignals, now, tcg: input.tcg });
  const totalSampleSize = rates.some((rate) => rate.sampleSize !== null) ? Math.max(...rates.map((rate) => rate.sampleSize ?? 0)) : null;
  const profile = pullRateProfile(input.tcg); const dataState: PullDataState = totalSampleSize !== null && totalSampleSize >= profile.communitySamples.established && !warnings.includes("conflicting_sources") ? "ESTABLISHED" : "PRELIMINARY";
  return {
    setId: input.setId, tcg: input.tcg, rates,
    overallHitRatePpm: overall?.probabilityPpm ?? null, highRarityHitRatePpm: high?.probabilityPpm ?? null, topTierHitRatePpm: top?.probabilityPpm ?? null, specificTopChaseRatePpm: chase?.probabilityPpm ?? null,
    averagePacksPerHitMilli: overall?.packsPerHitMilli ?? null, averagePacksPerHighRarityMilli: high?.packsPerHitMilli ?? null, averagePacksPerTopTierMilli: top?.packsPerHitMilli ?? null,
    expectedHitsPerBoxMilli: calculateExpectedHitsPerBox(overall?.probabilityPpm ?? null, input.packsPerBoosterBox ?? null),
    expectedHighRarityHitsPerBoxMilli: calculateExpectedHitsPerBox(high?.probabilityPpm ?? null, input.packsPerBoosterBox ?? null),
    expectedTopTierHitsPerBoxMilli: calculateExpectedHitsPerBox(top?.probabilityPpm ?? null, input.packsPerBoosterBox ?? null),
    expectedTopChaseHitsPerBoxMilli: calculateExpectedHitsPerBox(chase?.probabilityPpm ?? null, input.packsPerBoosterBox ?? null),
    packsPerBoosterBox: input.packsPerBoosterBox ?? null, hitFrequencyScore, topChaseDifficulty, pullRateAttractiveness, openingDemandPotential, pullDataCompleteness,
    confidence: combinedConfidence(rates, pullDataCompleteness), dataState, totalSampleSize, warnings,
  };
}
