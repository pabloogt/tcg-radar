import type { SupabaseClient } from "@supabase/supabase-js";
import { cardAnalyticsToSetMetricSignals, loadSetCardIntelligence } from "@/lib/cards/service";
import { loadSetPullRateIntelligence, pullAnalyticsToSetMetricSignals } from "@/lib/pull-rates/service";
import { loadSetMarketIntelligence, marketIntelligenceToSetMetricSignals } from "@/lib/market-signals/service";
import type { Database } from "@/lib/supabase/database.types";
import { deriveInternalSetSignals } from "./internal-signals";
import { mergeSetMetricSignals } from "./provider";
import { calculateHorizonScores, calculateScoreConfidence, mergeEffectiveMetrics, shouldCreateInvestmentSnapshot, type InvestmentMetrics } from "./scoring";
import { metricsFromJson, metricsFromRow, metricsToJson } from "./storage";

export async function loadEffectiveSetMetrics(client: SupabaseClient<Database>, userId: string, setId: string, now = new Date()): Promise<InvestmentMetrics> {
  const [{ data: configuredRow, error: metricsError }, { data: products, error: productsError }, cardMap, marketMap] = await Promise.all([
    client.from("set_investment_metrics").select("*").eq("user_id", userId).eq("set_id", setId).maybeSingle(),
    client.from("products").select("id").eq("user_id", userId).eq("set_id", setId),
    loadSetCardIntelligence(client, userId, [setId], now),
    loadSetMarketIntelligence(client, userId, [setId], now),
  ]);
  if (metricsError || productsError) throw metricsError ?? productsError;
  const pullMap = await loadSetPullRateIntelligence(client, userId, [setId], cardMap, now);
  const productIds = (products ?? []).map((product) => product.id);
  const { data: listings, error: listingsError } = productIds.length ? await client.from("listings").select("id,product_id,store_id,stock_status").eq("user_id", userId).in("product_id", productIds).limit(1_000) : { data: [], error: null };
  if (listingsError) throw listingsError;
  const listingIds = (listings ?? []).map((listing) => listing.id);
  const since = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const { data: history, error: historyError } = listingIds.length ? await client.from("price_history").select("listing_id,price_cents,shipping_cents,shipping_known,stock_status,recorded_at").eq("user_id", userId).in("listing_id", listingIds).gte("recorded_at", since).order("recorded_at", { ascending: false }).limit(3_000) : { data: [], error: null };
  if (historyError) throw historyError;
  const internal = deriveInternalSetSignals({ productIds, listings: (listings ?? []).map((listing) => ({ id: listing.id, productId: listing.product_id, storeId: listing.store_id, stockStatus: listing.stock_status })), history: (history ?? []).map((entry) => ({ listingId: entry.listing_id, priceCents: entry.price_cents, shippingCents: entry.shipping_cents, shippingKnown: entry.shipping_known, stockStatus: entry.stock_status, recordedAt: entry.recorded_at })), now });
  const derived = mergeSetMetricSignals([cardAnalyticsToSetMetricSignals(cardMap.get(setId)), pullAnalyticsToSetMetricSignals(pullMap.get(setId)), marketIntelligenceToSetMetricSignals(marketMap.get(setId)), internal]);
  return mergeEffectiveMetrics(metricsFromRow(configuredRow), derived.metrics);
}

export async function persistEffectiveSetSnapshot(client: SupabaseClient<Database>, userId: string, setId: string, now = new Date()): Promise<boolean> {
  const [metrics, latestResponse] = await Promise.all([loadEffectiveSetMetrics(client, userId, setId, now), client.from("set_investment_snapshots").select("metrics").eq("user_id", userId).eq("set_id", setId).order("observed_at", { ascending: false }).limit(1).maybeSingle()]);
  if (latestResponse.error) throw latestResponse.error;
  const previous = latestResponse.data ? metricsFromJson(latestResponse.data.metrics) : null;
  if (!shouldCreateInvestmentSnapshot(previous, metrics)) return false;
  const scores = calculateHorizonScores(metrics); const completeness = Math.round((scores.short.dataCompleteness + scores.medium.dataCompleteness + scores.long.dataCompleteness) / 3);
  const { error } = await client.from("set_investment_snapshots").insert({ user_id: userId, set_id: setId, metrics: metricsToJson(metrics), short_score: scores.short.score, medium_score: scores.medium.score, long_score: scores.long.score, data_completeness: completeness, confidence: calculateScoreConfidence(completeness), observed_at: now.toISOString() });
  if (error) throw error;
  return true;
}
