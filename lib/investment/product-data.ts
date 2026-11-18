import type { SupabaseClient } from "@supabase/supabase-js";
import { sortListingsForComparison } from "@/lib/analytics/price-history";
import { cardAnalyticsToSetMetricSignals, loadSetCardIntelligence } from "@/lib/cards/service";
import { DEFAULT_DEAL_THRESHOLDS, evaluateDeal, type DealEvaluation } from "@/lib/market/deal";
import { calculateMarketReference, type MarketReferenceResult } from "@/lib/market/reference";
import { loadSetPullRateIntelligence, pullAnalyticsToSetMetricSignals } from "@/lib/pull-rates/service";
import { loadSetMarketIntelligence, marketIntelligenceToSetMetricSignals } from "@/lib/market-signals/service";
import type { Database, Tables } from "@/lib/supabase/database.types";
import { calculateEntryPriceScore, selectBestPurchasableListing } from "./entry-price";
import { deriveInternalSetSignals } from "./internal-signals";
import { mergeSetMetricSignals } from "./provider";
import { buildProductInvestmentResult, type ProductInvestmentResult } from "./product-scoring";
import { calculateProductVehicleScore, isSupportedProductInvestmentType, type ProductInvestmentProfile, type ProductVehicleResult } from "./product-vehicle";
import { calculateHorizonScores, mergeEffectiveMetrics, type HorizonScores, type InvestmentMetrics } from "./scoring";
import { deriveSetPriceMomentum } from "./signals";
import { metricsFromRow } from "./storage";

type StoreSummary = Pick<Tables<"stores">, "id" | "name" | "country">;
export type InvestmentListingView = Tables<"listings"> & { store: StoreSummary | null };

export type ProductInvestmentAnalysis = {
  product: Tables<"products">;
  set: Tables<"tcg_sets">;
  profile: Tables<"product_investment_profiles"> | null;
  vehicle: ProductVehicleResult;
  setScores: HorizonScores;
  effectiveSetMetrics: InvestmentMetrics;
  entry: ReturnType<typeof calculateEntryPriceScore>;
  result: ProductInvestmentResult;
  market: MarketReferenceResult;
  deal: DealEvaluation | null;
  bestListing: InvestmentListingView | null;
  listings: InvestmentListingView[];
};

export type ProductAnalysisFilters = { productIds?: readonly string[]; setIds?: readonly string[]; limit?: number; now?: Date };

function profileFromRow(row: Tables<"product_investment_profiles"> | null): ProductInvestmentProfile | null {
  return row ? { vehicleScoreOverride: row.vehicle_score_override, exclusive: row.exclusive, limitedDistribution: row.limited_distribution, specialPromoScore: row.special_promo_score, storageEfficiencyScore: row.storage_efficiency_score, liquidityScore: row.liquidity_score, sealedCollectabilityScore: row.sealed_collectability_score, notes: row.notes } : null;
}

function isPurchasable(status: string) { return status === "in_stock" || status === "preorder"; }

export async function loadProductInvestmentAnalyses(client: SupabaseClient<Database>, userId: string, filters: ProductAnalysisFilters = {}): Promise<ProductInvestmentAnalysis[]> {
  const limit = Math.min(Math.max(filters.limit ?? 250, 1), 500);
  let productQuery = client.from("products").select("*").eq("user_id", userId).not("set_id", "is", null).order("updated_at", { ascending: false }).limit(limit);
  if (filters.productIds?.length) productQuery = productQuery.in("id", [...filters.productIds]);
  if (filters.setIds?.length) productQuery = productQuery.in("set_id", [...filters.setIds]);
  const { data: candidateProducts, error: productError } = await productQuery;
  if (productError) throw productError;
  const eligibleProducts = (candidateProducts ?? []).filter((product) => isSupportedProductInvestmentType(product.product_type));
  if (!eligibleProducts.length) return [];

  const setIds = [...new Set(eligibleProducts.flatMap((product) => product.set_id ? [product.set_id] : []))];
  const now = filters.now ?? new Date();
  const [{ data: sets, error: setsError }, { data: metricRows, error: metricsError }, { data: profiles, error: profilesError }, { data: setProducts, error: setProductsError }, { data: dealSettings, error: settingsError }, cardAnalytics] = await Promise.all([
    client.from("tcg_sets").select("*").eq("user_id", userId).in("id", setIds),
    client.from("set_investment_metrics").select("*").eq("user_id", userId).in("set_id", setIds),
    client.from("product_investment_profiles").select("*").eq("user_id", userId).in("product_id", eligibleProducts.map((product) => product.id)),
    client.from("products").select("id,set_id").eq("user_id", userId).in("set_id", setIds).limit(1_000),
    client.from("deal_settings").select("good_price_bps,opportunity_bps,bargain_bps,expensive_bps").eq("user_id", userId).maybeSingle(),
    loadSetCardIntelligence(client, userId, setIds, now),
  ]);
  if (setsError || metricsError || profilesError || setProductsError || settingsError) throw setsError ?? metricsError ?? profilesError ?? setProductsError ?? settingsError;
  const [pullAnalytics, marketIntelligence] = await Promise.all([loadSetPullRateIntelligence(client, userId, setIds, cardAnalytics, now), loadSetMarketIntelligence(client, userId, setIds, now)]);
  const allProductIds = (setProducts ?? []).map((product) => product.id);
  const { data: listingRows, error: listingsError } = allProductIds.length ? await client.from("listings").select("*").eq("user_id", userId).in("product_id", allProductIds).limit(2_000) : { data: [], error: null };
  if (listingsError) throw listingsError;
  const listingIds = (listingRows ?? []).map((listing) => listing.id);
  const since = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const [{ data: historyRows, error: historyError }, { data: stores, error: storesError }] = await Promise.all([
    listingIds.length ? client.from("price_history").select("listing_id,price_cents,shipping_cents,shipping_known,stock_status,recorded_at").eq("user_id", userId).in("listing_id", listingIds).gte("recorded_at", since).order("recorded_at", { ascending: false }).limit(5_000) : Promise.resolve({ data: [], error: null }),
    listingRows?.length ? client.from("stores").select("id,name,country").eq("user_id", userId).in("id", [...new Set(listingRows.map((listing) => listing.store_id))]) : Promise.resolve({ data: [], error: null }),
  ]);
  if (historyError || storesError) throw historyError ?? storesError;

  const setMap = new Map((sets ?? []).map((set) => [set.id, set]));
  const metricsMap = new Map((metricRows ?? []).map((row) => [row.set_id, row]));
  const profileMap = new Map((profiles ?? []).map((profile) => [profile.product_id, profile]));
  const storeMap = new Map((stores ?? []).map((store) => [store.id, store]));
  const productByListing = new Map((listingRows ?? []).map((listing) => [listing.id, listing.product_id]));
  const listingsByProduct = new Map<string, Tables<"listings">[]>();
  const historyByProduct = new Map<string, NonNullable<typeof historyRows>>();
  for (const listing of listingRows ?? []) listingsByProduct.set(listing.product_id, [...(listingsByProduct.get(listing.product_id) ?? []), listing]);
  for (const history of historyRows ?? []) { const productId = productByListing.get(history.listing_id); if (productId) historyByProduct.set(productId, [...(historyByProduct.get(productId) ?? []), history]); }
  const signalListings = (listingRows ?? []).map((listing) => ({ id: listing.id, productId: listing.product_id, storeId: listing.store_id, stockStatus: listing.stock_status }));
  const signalHistory = (historyRows ?? []).map((history) => ({ listingId: history.listing_id, priceCents: history.price_cents, shippingCents: history.shipping_cents, shippingKnown: history.shipping_known, stockStatus: history.stock_status, recordedAt: history.recorded_at }));
  const setScoresMap = new Map<string, HorizonScores>();
  const setMetricsMap = new Map<string, InvestmentMetrics>();
  for (const setId of setIds) {
    const productIds = (setProducts ?? []).filter((product) => product.set_id === setId).map((product) => product.id);
    const internalSignals = deriveInternalSetSignals({ productIds, listings: signalListings, history: signalHistory, now });
    const derived = mergeSetMetricSignals([cardAnalyticsToSetMetricSignals(cardAnalytics.get(setId)), pullAnalyticsToSetMetricSignals(pullAnalytics.get(setId)), marketIntelligenceToSetMetricSignals(marketIntelligence.get(setId)), internalSignals]);
    const effectiveMetrics = mergeEffectiveMetrics(metricsFromRow(metricsMap.get(setId)), derived.metrics);
    setMetricsMap.set(setId, effectiveMetrics);
    setScoresMap.set(setId, calculateHorizonScores(effectiveMetrics));
  }
  const thresholds = dealSettings ? { goodPriceBps: dealSettings.good_price_bps, opportunityBps: dealSettings.opportunity_bps, bargainBps: dealSettings.bargain_bps, expensiveBps: dealSettings.expensive_bps } : DEFAULT_DEAL_THRESHOLDS;

  return eligibleProducts.flatMap<ProductInvestmentAnalysis>((product) => {
    if (!product.set_id) return [];
    const set = setMap.get(product.set_id);
    const setScores = setScoresMap.get(product.set_id);
    const effectiveSetMetrics = setMetricsMap.get(product.set_id);
    if (!set || !setScores || !effectiveSetMetrics) return [];
    const rawListings = listingsByProduct.get(product.id) ?? [];
    const best = selectBestPurchasableListing(rawListings.map((listing) => ({ ...listing, priceCents: listing.price_cents, shippingCents: listing.shipping_known ? listing.shipping_cents : null, shippingKnown: listing.shipping_known, stockStatus: listing.stock_status })));
    const productHistory = historyByProduct.get(product.id) ?? [];
    const market = calculateMarketReference({ productId: product.id, currentListings: rawListings.map((listing) => ({ productId: product.id, listingId: listing.id, storeId: listing.store_id, priceCents: listing.price_cents, shippingCents: listing.shipping_known ? listing.shipping_cents : null, shippingKnown: listing.shipping_known, stockStatus: listing.stock_status, observedAt: listing.checked_at })), history: productHistory.map((history) => ({ productId: product.id, listingId: history.listing_id, priceCents: history.price_cents, shippingCents: history.shipping_cents, shippingKnown: history.shipping_known, stockStatus: history.stock_status, observedAt: history.recorded_at })), now });
    const basis = best?.shippingKnown ? "TOTAL_ACQUISITION" as const : "BASE_PRICE" as const;
    const comparableHistory = productHistory.flatMap((history) => !isPurchasable(history.stock_status) ? [] : basis === "TOTAL_ACQUISITION" ? history.shipping_known && history.shipping_cents !== null ? [history.price_cents + history.shipping_cents] : [] : [history.price_cents]);
    const recent: number[] = []; const previous: number[] = [];
    for (const history of productHistory) { if (!isPurchasable(history.stock_status)) continue; const value = basis === "TOTAL_ACQUISITION" ? history.shipping_known && history.shipping_cents !== null ? history.price_cents + history.shipping_cents : null : history.price_cents; if (value === null) continue; const age = now.getTime() - new Date(history.recorded_at).getTime(); if (age < 0 || age > 30 * 86_400_000) continue; if (age <= 7 * 86_400_000) recent.push(value); else previous.push(value); }
    const momentum = deriveSetPriceMomentum(recent, previous);
    const entry = calculateEntryPriceScore({ productPriceCents: best?.price_cents ?? 0, comparablePriceCents: best ? best.price_cents + (best.shippingKnown ? best.shipping_cents ?? 0 : 0) : 0, comparisonBasis: basis, shippingKnown: best?.shippingKnown ?? false, stockStatus: best?.stockStatus ?? "out_of_stock", marketReference: market.reference ? { priceCents: market.reference.referencePriceCents, comparisonBasis: market.reference.comparisonBasis, confidence: market.reference.confidence } : null, thirtyDayComparablePrices: comparableHistory, retailPriceCents: product.retail_price_cents, momentumScore: momentum });
    const profile = profileMap.get(product.id) ?? null;
    const vehicle = calculateProductVehicleScore(product.product_type, product.tcg, profileFromRow(profile));
    const bestListingView = best ? { ...rawListings.find((listing) => listing.id === best.id)!, store: storeMap.get(best.store_id) ?? null } : null;
    const result = buildProductInvestmentResult({ productId: product.id, setId: set.id, setScores, vehicleScore: vehicle.score, entry, bestListing: best ? { id: best.id, priceCents: best.price_cents + (best.shippingKnown ? best.shipping_cents ?? 0 : 0), stockStatus: best.stockStatus, shippingKnown: best.shippingKnown } : null, marketConfidence: market.reference?.confidence ?? null });
    const deal = best && market.reference ? evaluateDeal({ listingId: best.id, productId: product.id, priceCents: best.price_cents, shippingCents: best.shippingKnown ? best.shipping_cents : null, shippingKnown: best.shippingKnown, stockStatus: best.stockStatus }, market.reference, thresholds) : null;
    const listings = sortListingsForComparison(rawListings.map((listing) => ({ ...listing, store: storeMap.get(listing.store_id) ?? null, id: listing.id, storeId: listing.store_id, priceCents: listing.price_cents, shippingCents: listing.shipping_cents, shippingKnown: listing.shipping_known, stockStatus: listing.stock_status, checkedAt: listing.checked_at }))) as InvestmentListingView[];
    return [{ product, set, profile, vehicle, setScores, effectiveSetMetrics, entry, result, market, deal, bestListing: bestListingView, listings }];
  });
}
