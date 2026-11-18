import { investmentMetricKeys, investmentMetricLabels, investmentWeights, type InvestmentHorizon, type InvestmentMetricKey } from "./config";

export type InvestmentMetrics = Record<InvestmentMetricKey, number | null>;
export type ScoreConfidence = "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT";
export type InvestmentLabel = "EXCEPTIONAL" | "STRONG" | "INTERESTING" | "WATCH" | "WEAK";
export type InvestmentScore = { score: number | null; dataCompleteness: number; confidence: ScoreConfidence; label: InvestmentLabel | null };
export type HorizonScores = Record<InvestmentHorizon, InvestmentScore>;

export function calculateScoreConfidence(completeness: number): ScoreConfidence {
  if (completeness >= 85) return "HIGH";
  if (completeness >= 65) return "MEDIUM";
  if (completeness >= 40) return "LOW";
  return "INSUFFICIENT";
}

export function classifyInvestmentScore(score: number): InvestmentLabel {
  if (score >= 90) return "EXCEPTIONAL";
  if (score >= 80) return "STRONG";
  if (score >= 70) return "INTERESTING";
  if (score >= 60) return "WATCH";
  return "WEAK";
}

export function calculateMetricContribution(value: number, weight: number): number {
  return value * weight;
}

export function calculateDataCompleteness(metrics: InvestmentMetrics, horizon: InvestmentHorizon): number {
  const weights = investmentWeights[horizon];
  return investmentMetricKeys.reduce((total, key) => total + (metrics[key] === null ? 0 : weights[key]), 0);
}

export function calculateInvestmentScore(metrics: InvestmentMetrics, horizon: InvestmentHorizon): InvestmentScore {
  const weights = investmentWeights[horizon];
  const coveredWeight = calculateDataCompleteness(metrics, horizon);
  let weightedValue = 0;
  for (const key of investmentMetricKeys) {
    const value = metrics[key];
    if (value === null) continue;
    weightedValue += calculateMetricContribution(value, weights[key]);
  }
  const dataCompleteness = coveredWeight;
  const confidence = calculateScoreConfidence(dataCompleteness);
  if (coveredWeight === 0) return { score: null, dataCompleteness, confidence, label: null };
  const score = Math.round(weightedValue / coveredWeight);
  return { score, dataCompleteness, confidence, label: classifyInvestmentScore(score) };
}

export function calculateHorizonScores(metrics: InvestmentMetrics): HorizonScores {
  return { short: calculateInvestmentScore(metrics, "short"), medium: calculateInvestmentScore(metrics, "medium"), long: calculateInvestmentScore(metrics, "long") };
}

export type InvestmentReasons = { positives: string[]; negatives: string[] };

export function getInvestmentReasons(metrics: InvestmentMetrics, horizon: InvestmentHorizon): InvestmentReasons {
  const weights = investmentWeights[horizon];
  const available = investmentMetricKeys.flatMap((key) => metrics[key] === null ? [] : [{ key, value: metrics[key]!, weight: weights[key] }]);
  const positives = available.filter((item) => item.value >= 70).sort((left, right) => right.value * right.weight - left.value * left.weight || left.key.localeCompare(right.key)).slice(0, 3).map((item) => `${investmentMetricLabels[item.key]}: ${item.value}/100.`);
  const negatives = available.filter((item) => item.value <= 50).sort((left, right) => (100 - right.value) * right.weight - (100 - left.value) * left.weight || left.key.localeCompare(right.key)).slice(0, 2).map((item) => `${investmentMetricLabels[item.key]} limitada: ${item.value}/100.`);
  return { positives, negatives };
}

export function emptyInvestmentMetrics(): InvestmentMetrics {
  return Object.fromEntries(investmentMetricKeys.map((key) => [key, null])) as InvestmentMetrics;
}

export function mergeEffectiveMetrics(manual: InvestmentMetrics, derived: Partial<InvestmentMetrics>): InvestmentMetrics {
  return Object.fromEntries(investmentMetricKeys.map((key) => [key, manual[key] ?? derived[key] ?? null])) as InvestmentMetrics;
}

export function shouldCreateInvestmentSnapshot(previousMetrics: InvestmentMetrics | null, nextMetrics: InvestmentMetrics): boolean {
  return !previousMetrics || investmentMetricKeys.some((key) => previousMetrics[key] !== nextMetrics[key]);
}
