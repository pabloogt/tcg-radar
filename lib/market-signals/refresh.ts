import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { persistEffectiveSetSnapshot } from "@/lib/investment/set-snapshots";
import type { Database, Json } from "@/lib/supabase/database.types";
import { MARKET_SIGNAL_CHANGE_THRESHOLD } from "./config";
import { classifyReprintStatus } from "./analytics";
import { loadSetMarketIntelligence } from "./service";
import type { MarketSignalConfidence, MarketSignalType } from "./types";

export function shouldPersistDerivedMarketSignal(previous: { value: number; confidence: string } | null, next: { value: number; confidence: MarketSignalConfidence }, threshold = MARKET_SIGNAL_CHANGE_THRESHOLD): boolean {
  return !previous || previous.confidence !== next.confidence || Math.abs(previous.value - next.value) >= threshold;
}

export async function refreshSetMarketSignals(client: SupabaseClient<Database>, userId: string, setId: string, now = new Date()): Promise<{ signalsCreated: number; snapshotCreated: boolean }> {
  const intelligence = (await loadSetMarketIntelligence(client, userId, [setId], now)).get(setId);
  if (!intelligence) return { signalsCreated: 0, snapshotCreated: false };
  const { data: previousRows, error: previousError } = await client.from("set_market_signals").select("signal_type,value,confidence").eq("user_id", userId).eq("set_id", setId).eq("source_type", "derived").in("signal_type", ["demand_score", "reprint_risk"]).order("observed_at", { ascending: false }).limit(20);
  if (previousError) throw previousError;
  const latest = new Map<MarketSignalType, { value: number; confidence: string }>();
  for (const row of previousRows ?? []) if (!latest.has(row.signal_type as MarketSignalType)) latest.set(row.signal_type as MarketSignalType, { value: row.value, confidence: row.confidence });
  const writes: Database["public"]["Tables"]["set_market_signals"]["Insert"][] = [];
  if (intelligence.demand.derivedScore !== null && intelligence.demand.confidence !== "INSUFFICIENT" && shouldPersistDerivedMarketSignal(latest.get("demand_score") ?? null, { value: intelligence.demand.derivedScore, confidence: intelligence.demand.confidence })) {
    const metadata: Json = { restocks30d: intelligence.demand.restocks30d, selloutCycles: intelligence.demand.selloutCycles, storesWithSet: intelligence.demand.coverage.storesWithSet, historyDays: intelligence.demand.historyDays };
    writes.push({ user_id: userId, set_id: setId, signal_type: "demand_score", source_type: "derived", source_key: "internal_market_signals", value: intelligence.demand.derivedScore, confidence: intelligence.demand.confidence, observed_at: now.toISOString(), sample_size: intelligence.demand.coverage.activeListings, metadata });
  }
  if (intelligence.reprint.derivedRisk !== null && intelligence.reprint.confidence !== "INSUFFICIENT" && shouldPersistDerivedMarketSignal(latest.get("reprint_risk") ?? null, { value: intelligence.reprint.derivedRisk, confidence: intelligence.reprint.confidence })) {
    const metadata: Json = { availabilityExpansionScore: intelligence.reprint.availabilityExpansionScore, broadRestockStores: intelligence.reprint.broadRestockStores, inferredOnly: !intelligence.reprint.confirmedReprint };
    writes.push({ user_id: userId, set_id: setId, signal_type: "reprint_risk", source_type: "derived", source_key: "market_signal_model", value: intelligence.reprint.derivedRisk, confidence: intelligence.reprint.confidence, observed_at: now.toISOString(), sample_size: intelligence.demand.coverage.storesWithSet, metadata, reprint_status: classifyReprintStatus(intelligence.reprint.derivedRisk, false), confirmed_reprint: false });
  }
  if (writes.length) { const { error } = await client.from("set_market_signals").insert(writes); if (error) throw error; }
  const snapshotCreated = writes.length ? await persistEffectiveSetSnapshot(client, userId, setId, now) : false;
  return { signalsCreated: writes.length, snapshotCreated };
}

export async function refreshSetMarketSignalsSafely(client: SupabaseClient<Database>, userId: string, setId: string, now = new Date()): Promise<{ ok: boolean; signalsCreated: number; snapshotCreated: boolean }> {
  try { const result = await refreshSetMarketSignals(client, userId, setId, now); return { ok: true, ...result }; }
  catch { return { ok: false, signalsCreated: 0, snapshotCreated: false }; }
}

export async function refreshMarketSignalsForProductsSafely(client: SupabaseClient<Database>, userId: string, productIds: readonly string[], now = new Date()): Promise<{ setsAttempted: number; setsRefreshed: number }> {
  if (!productIds.length) return { setsAttempted: 0, setsRefreshed: 0 };
  try {
    const { data, error } = await client.from("products").select("set_id").eq("user_id", userId).in("id", [...new Set(productIds)]).not("set_id", "is", null).limit(1_000);
    if (error) return { setsAttempted: 0, setsRefreshed: 0 };
    const setIds = [...new Set((data ?? []).flatMap((product) => product.set_id ? [product.set_id] : []))];
    const results = await Promise.all(setIds.map((setId) => refreshSetMarketSignalsSafely(client, userId, setId, now)));
    return { setsAttempted: setIds.length, setsRefreshed: results.filter((result) => result.ok).length };
  } catch { return { setsAttempted: 0, setsRefreshed: 0 }; }
}
