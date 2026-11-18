import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { SetMetricSignals } from "@/lib/investment/provider";
import { calculateSetCardAnalytics, type CardAnalyticsCard, type CardPriceObservation, type SetCardAnalytics } from "./analytics";

export async function loadSetCardIntelligence(client: SupabaseClient<Database>, userId: string, setIds: readonly string[], now = new Date()): Promise<Map<string, SetCardAnalytics>> {
  if (!setIds.length) return new Map();
  const { data: cards, error: cardsError } = await client.from("tcg_cards").select("id,set_id,tcg,name,card_number,rarity,rarity_group,image_url,character_name,variant_name").eq("user_id", userId).in("set_id", [...setIds]).limit(5_000);
  if (cardsError) throw cardsError;
  const cardIds = (cards ?? []).map((card) => card.id);
  const since = new Date(now.getTime() - 45 * 86_400_000).toISOString();
  const { data: history, error: historyError } = cardIds.length ? await client.from("card_price_history").select("id,card_id,source,currency,market_price_cents,low_price_cents,trend_price_cents,observed_at").eq("user_id", userId).in("card_id", cardIds).gte("observed_at", since).order("observed_at", { ascending: false }).limit(20_000) : { data: [], error: null };
  if (historyError) throw historyError;
  const historyByCard = new Map((cards ?? []).map((card) => [card.id, card.set_id]));
  const result = new Map<string, SetCardAnalytics>();
  for (const setId of setIds) {
    const setCards = (cards ?? []).filter((card) => card.set_id === setId);
    if (!setCards.length) continue;
    const tcg = setCards[0].tcg;
    const normalizedCards: CardAnalyticsCard[] = setCards.map((card) => ({ id: card.id, name: card.name, cardNumber: card.card_number, rarity: card.rarity, rarityGroup: card.rarity_group, imageUrl: card.image_url, characterName: card.character_name, variantName: card.variant_name }));
    const observations: CardPriceObservation[] = (history ?? []).filter((entry) => historyByCard.get(entry.card_id) === setId).map((entry) => ({ id: entry.id, cardId: entry.card_id, source: entry.source, currency: entry.currency, marketPriceCents: entry.market_price_cents, lowPriceCents: entry.low_price_cents, trendPriceCents: entry.trend_price_cents, observedAt: entry.observed_at }));
    result.set(setId, calculateSetCardAnalytics({ setId, tcg, cards: normalizedCards, observations, now }));
  }
  return result;
}

export function cardAnalyticsToSetMetricSignals(analytics: SetCardAnalytics | null | undefined): SetMetricSignals {
  if (!analytics || analytics.confidence === "INSUFFICIENT") return { metrics: {}, provenance: {} };
  const confidence = analytics.confidence;
  const note = `${analytics.metrics.pricedCardCount}/${analytics.metrics.cardCount} cartas con precio EUR vigente; cobertura ${(analytics.priceCoverageBps / 100).toFixed(0)}%.`;
  const metrics = { ...(analytics.chaseStrength === null ? {} : { chaseStrength: analytics.chaseStrength }), ...(analytics.chaseDepth === null ? {} : { chaseDepth: analytics.chaseDepth }), ...(analytics.cardValue === null ? {} : { cardValue: analytics.cardValue }), ...(analytics.momentum.score === null || analytics.momentum.confidence === "INSUFFICIENT" ? {} : { priceMomentum: analytics.momentum.score }) };
  return { metrics, provenance: { ...(analytics.chaseStrength === null ? {} : { chaseStrength: { sourceType: "derived" as const, confidence, sourceNote: note } }), ...(analytics.chaseDepth === null ? {} : { chaseDepth: { sourceType: "derived" as const, confidence, sourceNote: note } }), ...(analytics.cardValue === null ? {} : { cardValue: { sourceType: "derived" as const, confidence, sourceNote: note } }), ...(analytics.momentum.score === null || analytics.momentum.confidence === "INSUFFICIENT" ? {} : { priceMomentum: { sourceType: "derived" as const, confidence: analytics.momentum.confidence, sourceNote: `Momentum de ${analytics.momentum.cardsUsed} cartas principales.` } }) } };
}
