import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";
import type { CardImportRepository, CardWrite, ExistingImportCard, PriceWrite } from "./import";

function externalIds(value: Json): Record<string, string> { if (!value || typeof value !== "object" || Array.isArray(value)) return {}; return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string")); }

export class SupabaseCardImportRepository implements CardImportRepository {
  constructor(private readonly client: SupabaseClient<Database>, private readonly userId: string) {}

  async listCards(setId: string): Promise<ExistingImportCard[]> {
    const { data, error } = await this.client.from("tcg_cards").select("id,set_id,name,card_number,rarity,variant_name,external_ids").eq("user_id", this.userId).eq("set_id", setId).limit(5_000);
    if (error) throw error;
    return (data ?? []).map((card) => ({ id: card.id, setId: card.set_id, name: card.name, cardNumber: card.card_number, rarity: card.rarity, variantName: card.variant_name, externalIds: externalIds(card.external_ids) }));
  }

  async upsertCards(cards: readonly CardWrite[]): Promise<void> {
    if (!cards.length) return;
    const { error } = await this.client.from("tcg_cards").upsert(cards.map((card) => ({ user_id: this.userId, set_id: card.setId, tcg: card.tcg, name: card.name, card_number: card.cardNumber, rarity: card.rarity, rarity_group: card.rarityGroup, normalized_key: card.normalizedKey, image_url: card.imageUrl, character_name: card.characterName, variant_name: card.variantName, external_ids: card.externalIds })), { onConflict: "user_id,set_id,normalized_key,card_number" });
    if (error) throw error;
  }

  async listObservationKeys(cardIds: readonly string[]): Promise<Set<string>> {
    if (!cardIds.length) return new Set();
    const { data, error } = await this.client.from("card_price_history").select("card_id,source,observation_key").eq("user_id", this.userId).in("card_id", [...cardIds]).limit(10_000);
    if (error) throw error;
    return new Set((data ?? []).map((entry) => `${entry.card_id}|${entry.source}|${entry.observation_key}`));
  }

  async insertPrices(prices: readonly PriceWrite[]): Promise<void> {
    if (!prices.length) return;
    const { error } = await this.client.from("card_price_history").insert(prices.map((price) => ({ user_id: this.userId, card_id: price.cardId, source: price.source, currency: price.currency, market_price_cents: price.marketPriceCents, low_price_cents: price.lowPriceCents, trend_price_cents: price.trendPriceCents, observed_at: price.observedAt, observation_key: price.observationKey, source_metadata: price.sourceMetadata })));
    if (error) throw error;
  }
}
