import type { InvestmentMetrics, ScoreConfidence } from "./scoring";
import { investmentMetricKeys, type InvestmentMetricKey } from "./config";

export type MetricSourceType = "manual" | "official" | "internal" | "external" | "derived";
export type MetricProvenance = { sourceType: MetricSourceType; confidence: Exclude<ScoreConfidence, "INSUFFICIENT">; sourceNote: string | null };
export type SetMetricSignals = { metrics: Partial<InvestmentMetrics>; provenance: Partial<Record<keyof InvestmentMetrics, MetricProvenance>> };

export interface SetMetricsProvider {
  readonly sourceKey: string;
  provide(setId: string): Promise<SetMetricSignals>;
}

const confidenceRank: Record<MetricProvenance["confidence"], number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
const sourceRank: Record<MetricSourceType, number> = { manual: 5, official: 4, external: 3, internal: 2, derived: 1 };

export function resolveEffectiveInvestmentMetric(manualValue: number | null, candidates: readonly { value: number | null | undefined; provenance: MetricProvenance | undefined }[]) {
  if (manualValue !== null) return { value: manualValue, source: "manual" as const, provenance: null };
  const selected = candidates.flatMap((candidate, index) => candidate.value === null || candidate.value === undefined ? [] : [{ ...candidate, value: candidate.value, index }]).sort((left, right) => Number(right.provenance?.sourceType === "manual") - Number(left.provenance?.sourceType === "manual") || confidenceRank[right.provenance?.confidence ?? "LOW"] - confidenceRank[left.provenance?.confidence ?? "LOW"] || sourceRank[right.provenance?.sourceType ?? "derived"] - sourceRank[left.provenance?.sourceType ?? "derived"] || left.index - right.index)[0];
  return selected ? { value: selected.value, source: "derived" as const, provenance: selected.provenance ?? null } : { value: null, source: "none" as const, provenance: null };
}

export function mergeSetMetricSignals(signals: readonly SetMetricSignals[]): SetMetricSignals {
  const metrics: Partial<InvestmentMetrics> = {}; const provenance: Partial<Record<InvestmentMetricKey, MetricProvenance>> = {};
  for (const key of investmentMetricKeys) { const resolved = resolveEffectiveInvestmentMetric(null, signals.map((signal) => ({ value: signal.metrics[key], provenance: signal.provenance[key] }))); if (resolved.value === null) continue; metrics[key] = resolved.value; if (resolved.provenance) provenance[key] = resolved.provenance; }
  return { metrics, provenance };
}
