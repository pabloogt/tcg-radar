import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";
import type { PullImportCard, PullRateImportRepository, PullRateWrite } from "./import";

function externalIds(value: Json): Record<string, string> { if (!value || typeof value !== "object" || Array.isArray(value)) return {}; return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string")); }

export class SupabasePullRateRepository implements PullRateImportRepository {
  constructor(private readonly client: SupabaseClient<Database>, private readonly userId: string) {}

  async listCards(setId: string): Promise<PullImportCard[]> {
    const { data, error } = await this.client.from("tcg_cards").select("id,card_number,variant_name,external_ids").eq("user_id", this.userId).eq("set_id", setId).limit(5_000); if (error) throw error;
    return (data ?? []).map((card) => ({ id: card.id, cardNumber: card.card_number, variantName: card.variant_name, externalIds: externalIds(card.external_ids) }));
  }

  async listObservationKeys(setId: string): Promise<Set<string>> {
    const { data, error } = await this.client.from("set_pull_rates").select("source,observation_key").eq("user_id", this.userId).eq("set_id", setId).limit(10_000); if (error) throw error;
    return new Set((data ?? []).map((row) => `${row.source}|${row.observation_key}`));
  }

  async upsertRates(rates: readonly PullRateWrite[]): Promise<void> {
    if (!rates.length) return;
    const { error } = await this.client.from("set_pull_rates").upsert(rates.map((rate) => ({ user_id: this.userId, set_id: rate.setId, card_id: rate.cardId, category: rate.category, category_group: rate.categoryGroup, subcategory: rate.subcategory, odds_numerator: rate.oddsNumerator, odds_denominator: rate.oddsDenominator, probability_ppm: rate.probabilityPpm, sample_size: rate.sampleSize, source: rate.source, source_type: rate.sourceType, confidence: rate.reportedConfidence, source_note: rate.sourceNote, outcome_group: rate.outcomeGroup, mutually_exclusive: rate.mutuallyExclusive, observed_at: rate.observedAt, observation_key: rate.observationKey, source_metadata: rate.sourceMetadata })), { onConflict: "user_id,set_id,source,observation_key" });
    if (error) throw error;
  }
}
