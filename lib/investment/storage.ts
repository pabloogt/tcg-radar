import type { Json, Tables } from "@/lib/supabase/database.types";
import { emptyInvestmentMetrics, type InvestmentMetrics } from "./scoring";
import type { InvestmentMetricKey } from "./config";
import type { MetricProvenance, MetricSourceType } from "./provider";

const columns: Record<InvestmentMetricKey, keyof Tables<"set_investment_metrics">> = {
  chaseStrength: "chase_strength", chaseDepth: "chase_depth", cardValue: "card_value", pullRateAttractiveness: "pull_rate_attractiveness", characterStrength: "character_strength", collectorAppeal: "collector_appeal", demand: "demand", hype: "hype", scarcity: "scarcity", reprintSafety: "reprint_safety", priceMomentum: "price_momentum", setMaturity: "set_maturity",
};

export function metricsFromRow(row: Tables<"set_investment_metrics"> | null | undefined): InvestmentMetrics {
  const metrics = emptyInvestmentMetrics();
  if (!row) return metrics;
  for (const [key, column] of Object.entries(columns) as [InvestmentMetricKey, keyof Tables<"set_investment_metrics">][]) {
    const value = row[column];
    metrics[key] = typeof value === "number" ? value : null;
  }
  return metrics;
}

export function metricsToColumns(metrics: InvestmentMetrics) {
  return { chase_strength: metrics.chaseStrength, chase_depth: metrics.chaseDepth, card_value: metrics.cardValue, pull_rate_attractiveness: metrics.pullRateAttractiveness, character_strength: metrics.characterStrength, collector_appeal: metrics.collectorAppeal, demand: metrics.demand, hype: metrics.hype, scarcity: metrics.scarcity, reprint_safety: metrics.reprintSafety, price_momentum: metrics.priceMomentum, set_maturity: metrics.setMaturity };
}

export function metricsToJson(metrics: InvestmentMetrics): Json {
  return { ...metrics };
}

export function metricsFromJson(value: Json): InvestmentMetrics | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const metrics = emptyInvestmentMetrics();
  for (const key of Object.keys(metrics) as InvestmentMetricKey[]) {
    const item = value[key];
    if (item !== null && typeof item !== "number") return null;
    metrics[key] = item;
  }
  return metrics;
}

const sourceTypes: readonly MetricSourceType[] = ["manual", "official", "internal", "external", "derived"];
const provenanceConfidences: readonly MetricProvenance["confidence"][] = ["HIGH", "MEDIUM", "LOW"];

export function provenanceFromJson(value: Json): Partial<Record<InvestmentMetricKey, MetricProvenance>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Partial<Record<InvestmentMetricKey, MetricProvenance>> = {};
  for (const key of Object.keys(emptyInvestmentMetrics()) as InvestmentMetricKey[]) {
    const item = value[key];
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const sourceType = item.sourceType;
    const confidence = item.confidence;
    const sourceNote = item.sourceNote;
    if (typeof sourceType !== "string" || !sourceTypes.includes(sourceType as MetricSourceType)) continue;
    if (typeof confidence !== "string" || !provenanceConfidences.includes(confidence as MetricProvenance["confidence"])) continue;
    if (sourceNote !== null && typeof sourceNote !== "string") continue;
    result[key] = { sourceType: sourceType as MetricSourceType, confidence: confidence as MetricProvenance["confidence"], sourceNote };
  }
  return result;
}
