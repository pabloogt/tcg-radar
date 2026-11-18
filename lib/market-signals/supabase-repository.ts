import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { MarketSignalConfidence, MarketSignalObservation, MarketSignalSourceType, MarketSignalType, ReprintStatus, StockState } from "./types";
import type { MarketSignalDataset, MarketSignalRepository } from "./repository";

export class SupabaseMarketSignalRepository implements MarketSignalRepository {
  constructor(private readonly client: SupabaseClient<Database>, private readonly userId: string) {}

  async load(setIds: readonly string[], since: string): Promise<MarketSignalDataset> {
    if (!setIds.length) return { sets: [], products: [], listings: [], history: [], signals: [], monitorRuns: [], monitoredStores: 0 };
    const [{ data: sets, error: setsError }, { data: products, error: productsError }, { data: signalRows, error: signalsError }, { count: monitoredStores, error: storesError }, { data: monitorRuns, error: runsError }] = await Promise.all([
      this.client.from("tcg_sets").select("id,release_date").eq("user_id", this.userId).in("id", [...setIds]).limit(500),
      this.client.from("products").select("id,set_id").eq("user_id", this.userId).in("set_id", [...setIds]).limit(5_000),
      this.client.from("set_market_signals").select("id,set_id,signal_type,source_type,source_key,value,confidence,observed_at,sample_size,note,confirmed_reprint,reprint_status,announcement_date,expected_supply_date").eq("user_id", this.userId).in("set_id", [...setIds]).order("observed_at", { ascending: false }).limit(10_000),
      this.client.from("stores").select("id", { count: "exact", head: true }).eq("user_id", this.userId).eq("active", true),
      this.client.from("monitor_runs").select("source_key,status,started_at").eq("user_id", this.userId).gte("started_at", since).in("status", ["completed", "partial"]).order("started_at", { ascending: false }).limit(2_000),
    ]);
    if (setsError || productsError || signalsError || storesError || runsError) throw setsError ?? productsError ?? signalsError ?? storesError ?? runsError;
    const productIds = (products ?? []).map((product) => product.id);
    const { data: listings, error: listingsError } = productIds.length ? await this.client.from("listings").select("id,product_id,store_id,source_key,stock_status,checked_at").eq("user_id", this.userId).in("product_id", productIds).limit(10_000) : { data: [], error: null };
    if (listingsError) throw listingsError;
    const listingIds = (listings ?? []).map((listing) => listing.id);
    const { data: history, error: historyError } = listingIds.length ? await this.client.from("price_history").select("listing_id,price_cents,shipping_cents,shipping_known,stock_status,recorded_at").eq("user_id", this.userId).in("listing_id", listingIds).gte("recorded_at", since).order("recorded_at", { ascending: true }).limit(20_000) : { data: [], error: null };
    if (historyError) throw historyError;
    return {
      sets: (sets ?? []).map((set) => ({ id: set.id, releaseDate: set.release_date })),
      products: (products ?? []).flatMap((product) => product.set_id ? [{ id: product.id, setId: product.set_id }] : []),
      listings: (listings ?? []).map((listing) => ({ id: listing.id, productId: listing.product_id, storeId: listing.store_id, sourceKey: listing.source_key, stockStatus: listing.stock_status as StockState, checkedAt: listing.checked_at })),
      history: (history ?? []).map((entry) => ({ listingId: entry.listing_id, priceCents: entry.price_cents, shippingCents: entry.shipping_cents, shippingKnown: entry.shipping_known, stockStatus: entry.stock_status as StockState, recordedAt: entry.recorded_at })),
      signals: (signalRows ?? []).map<MarketSignalObservation>((row) => ({ id: row.id, setId: row.set_id, signalType: row.signal_type as MarketSignalType, sourceType: row.source_type as MarketSignalSourceType, sourceKey: row.source_key, value: row.value, confidence: row.confidence as Exclude<MarketSignalConfidence, "INSUFFICIENT">, observedAt: row.observed_at, sampleSize: row.sample_size, note: row.note, confirmedReprint: row.confirmed_reprint, reprintStatus: row.reprint_status as ReprintStatus | null, announcementDate: row.announcement_date, expectedSupplyDate: row.expected_supply_date })),
      monitorRuns: (monitorRuns ?? []).map((run) => ({ sourceKey: run.source_key, status: run.status, startedAt: run.started_at })),
      monitoredStores: monitoredStores ?? 0,
    };
  }
}
