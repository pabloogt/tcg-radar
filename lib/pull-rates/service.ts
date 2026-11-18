import type { SupabaseClient } from "@supabase/supabase-js";
import type { SetCardAnalytics } from "@/lib/cards/analytics";
import type { Database } from "@/lib/supabase/database.types";
import type { SetMetricSignals } from "@/lib/investment/provider";
import { calculateSetPullAnalytics } from "./analytics";
import type { PullRateCategoryGroup, PullRateConfidence, PullRateObservation, PullRateSourceType, SetPullRateAnalytics } from "./types";

export async function loadSetPullRateIntelligence(client: SupabaseClient<Database>, userId: string, setIds: readonly string[], cardAnalytics?: ReadonlyMap<string, SetCardAnalytics>, now = new Date()): Promise<Map<string, SetPullRateAnalytics>> {
  if (!setIds.length) return new Map();
  const [{ data: sets, error: setsError }, { data: rows, error: ratesError }] = await Promise.all([
    client.from("tcg_sets").select("id,tcg,packs_per_booster_box").eq("user_id", userId).in("id", [...setIds]).limit(500),
    client.from("set_pull_rates").select("id,set_id,card_id,category,category_group,subcategory,odds_numerator,odds_denominator,probability_ppm,sample_size,source,source_type,confidence,source_note,outcome_group,mutually_exclusive,observed_at").eq("user_id", userId).in("set_id", [...setIds]).limit(10_000),
  ]);
  if (setsError || ratesError) throw setsError ?? ratesError;
  const result = new Map<string, SetPullRateAnalytics>();
  for (const set of sets ?? []) {
    const cards = cardAnalytics?.get(set.id);
    const observations: PullRateObservation[] = (rows ?? []).filter((row) => row.set_id === set.id).map((row) => ({ id: row.id, setId: row.set_id, cardId: row.card_id, category: row.category, categoryGroup: row.category_group as PullRateCategoryGroup, subcategory: row.subcategory, oddsNumerator: row.odds_numerator, oddsDenominator: row.odds_denominator, probabilityPpm: row.probability_ppm, sampleSize: row.sample_size, source: row.source, sourceType: row.source_type as PullRateSourceType, reportedConfidence: row.confidence as Exclude<PullRateConfidence, "INSUFFICIENT"> | null, sourceNote: row.source_note, outcomeGroup: row.outcome_group, mutuallyExclusive: row.mutually_exclusive, observedAt: row.observed_at }));
    if (!observations.length) continue;
    result.set(set.id, calculateSetPullAnalytics({ setId: set.id, tcg: set.tcg, observations, crossSignals: { chaseStrength: cards?.chaseStrength ?? null, chaseDepth: cards?.chaseDepth ?? null, cardValue: cards?.cardValue ?? null, chaseConcentration: cards?.chaseConcentration ?? null }, packsPerBoosterBox: set.packs_per_booster_box, now }));
  }
  return result;
}

export function pullAnalyticsToSetMetricSignals(analytics: SetPullRateAnalytics | null | undefined): SetMetricSignals {
  if (!analytics || analytics.pullRateAttractiveness === null || analytics.confidence === "INSUFFICIENT") return { metrics: {}, provenance: {} };
  const note = `Pull Rate Intelligence: cobertura ${analytics.pullDataCompleteness}%, confianza ${analytics.confidence.toLowerCase()}${analytics.dataState === "PRELIMINARY" ? ", datos preliminares" : ""}.`;
  return { metrics: { pullRateAttractiveness: analytics.pullRateAttractiveness }, provenance: { pullRateAttractiveness: { sourceType: "derived", confidence: analytics.confidence, sourceNote: note } } };
}
