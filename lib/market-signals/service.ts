import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { deriveSetPriceMomentum } from "@/lib/investment/signals";
import type { MetricProvenance, SetMetricSignals } from "@/lib/investment/provider";
import type { Database } from "@/lib/supabase/database.types";
import {
  aggregateHypeSignals,
  calculateAvailabilityTrend,
  calculateBroadRestockStoreCount,
  calculateDemandConfidence,
  calculateDemandScore,
  calculateDecayedHypeValue,
  calculateHypeMomentum,
  calculateMedianSelloutTime,
  calculateReprintConfidence,
  calculateReprintRisk,
  calculateReprintSafety,
  calculateRestockActivityScore,
  calculateRestockEvents,
  calculateSelloutCycles,
  calculateSelloutConfidence,
  calculateSelloutEvents,
  calculateSelloutSpeedScore,
  clampScore,
  classifyReprintStatus,
  generateDemandReasons,
  generateMarketSignalWarnings,
  generateReprintReasons,
  resolveEffectiveMarketMetric,
} from "./analytics";
import { DAY_MS } from "./config";
import type { MarketSignalDataset, MarketSignalRepository } from "./repository";
import { SupabaseMarketSignalRepository } from "./supabase-repository";
import type { MarketSignalConfidence, MarketSignalObservation, SetMarketIntelligence, StockObservation } from "./types";

const reprintTypesForSource = new Set<MarketSignalObservation["signalType"]>(["reprint_event", "reprint_risk", "manual_reprint_risk", "official_reprint_announced", "official_restock_announced", "large_supply_return", "new_wave_detected", "availability_expansion", "distributor_signal", "set_out_of_print", "production_window_closed", "unknown_supply_status"]);

function latest(signals: readonly MarketSignalObservation[], predicate: (signal: MarketSignalObservation) => boolean): MarketSignalObservation | null {
  return [...signals].filter(predicate).sort((left, right) => right.observedAt.localeCompare(left.observedAt))[0] ?? null;
}

function confidenceForProvenance(value: MarketSignalConfidence): MetricProvenance["confidence"] | null {
  return value === "INSUFFICIENT" ? null : value;
}

function countSince<T extends { observedAt: string }>(values: readonly T[], since: number): number {
  return values.filter((value) => new Date(value.observedAt).getTime() >= since).length;
}

function historyLengthDays(values: readonly { recordedAt: string }[], now: Date): number {
  const timestamps = values.map((value) => new Date(value.recordedAt).getTime()).filter(Number.isFinite);
  return timestamps.length ? Math.min(90, Math.max(0, Math.floor((now.getTime() - Math.min(...timestamps)) / DAY_MS))) : 0;
}

export function calculateSetMarketIntelligence(dataset: MarketSignalDataset, setId: string, now: Date): SetMarketIntelligence {
  const set = dataset.sets.find((entry) => entry.id === setId);
  const products = dataset.products.filter((product) => product.setId === setId);
  const productIds = new Set(products.map((product) => product.id));
  const listings = dataset.listings.filter((listing) => productIds.has(listing.productId));
  const freshListings = listings.filter((listing) => { const checked = new Date(listing.checkedAt).getTime(); return Number.isFinite(checked) && checked <= now.getTime() && checked >= now.getTime() - 7 * DAY_MS; });
  const listingMap = new Map(listings.map((listing) => [listing.id, listing]));
  const history = dataset.history.filter((entry) => listingMap.has(entry.listingId));
  const signals = dataset.signals.filter((signal) => signal.setId === setId && new Date(signal.observedAt).getTime() <= now.getTime());
  const stockObservations: StockObservation[] = [
    ...history.map((entry) => { const listing = listingMap.get(entry.listingId)!; return { listingId: listing.id, productId: listing.productId, storeId: listing.storeId, stockStatus: entry.stockStatus, observedAt: entry.recordedAt }; }),
    ...freshListings.map((listing) => ({ listingId: listing.id, productId: listing.productId, storeId: listing.storeId, stockStatus: listing.stockStatus, observedAt: listing.checkedAt })),
  ];
  const restocks = calculateRestockEvents(stockObservations);
  const sellouts = calculateSelloutEvents(stockObservations);
  const cycles = calculateSelloutCycles(stockObservations);
  const restocks7d = countSince(restocks, now.getTime() - 7 * DAY_MS);
  const restocks30d = countSince(restocks, now.getTime() - 30 * DAY_MS);
  const restocks90d = countSince(restocks, now.getTime() - 90 * DAY_MS);
  const recentCycles = cycles.filter((cycle) => new Date(cycle.soldOutAt).getTime() >= now.getTime() - 90 * DAY_MS);
  const medianSelloutHours = calculateMedianSelloutTime(recentCycles);
  const fastSelloutShare = recentCycles.length ? recentCycles.filter((cycle) => cycle.durationHours <= 24).length / recentCycles.length : null;
  const trend7 = calculateAvailabilityTrend(stockObservations, now, 7);
  const trend30 = calculateAvailabilityTrend(stockObservations, now, 30);
  const expansionScore = [trend7.expansionScore, trend30.expansionScore].filter((value): value is number => value !== null).reduce<number | null>((maximum, value) => maximum === null ? value : Math.max(maximum, value), null);
  const distinctStores = new Set(freshListings.map((listing) => listing.storeId)).size;
  const storesInStock = new Set(freshListings.filter((listing) => listing.stockStatus === "in_stock").map((listing) => listing.storeId)).size;
  const activeListings = freshListings.filter((listing) => listing.stockStatus === "in_stock" || listing.stockStatus === "preorder").length;
  const productsObserved = new Set(freshListings.map((listing) => listing.productId)).size;
  const historyDays = historyLengthDays(history, now);
  const listingSourceKeys = new Set(freshListings.flatMap((listing) => listing.sourceKey ? [listing.sourceKey] : []));
  const monitorRuns30d = dataset.monitorRuns.filter((run) => listingSourceKeys.has(run.sourceKey) && new Date(run.startedAt).getTime() >= now.getTime() - 30 * DAY_MS).length;
  const confirmedPrices = history.filter((entry) => entry.shippingKnown && entry.shippingCents !== null && (entry.stockStatus === "in_stock" || entry.stockStatus === "preorder"));
  const recentPrices: number[] = []; const previousPrices: number[] = [];
  for (const entry of confirmedPrices) { const age = now.getTime() - new Date(entry.recordedAt).getTime(); if (age < 0 || age > 30 * DAY_MS) continue; const value = entry.priceCents + entry.shippingCents!; if (age <= 7 * DAY_MS) recentPrices.push(value); else previousPrices.push(value); }
  const sealedPriceMomentum = deriveSetPriceMomentum(recentPrices, previousPrices);
  const inStockPressure = freshListings.length ? clampScore((1 - activeListings / freshListings.length) * 100) : null;
  const components = {
    selloutSpeed: calculateSelloutSpeedScore(medianSelloutHours, fastSelloutShare),
    availabilityContraction: trend30.contractionScore,
    restockActivity: calculateRestockActivityScore(restocks30d, productsObserved),
    sealedPriceMomentum,
    inStockPressure,
  };
  const behavioralEvidence = restocks30d > 0 || sellouts.length > 0 || (trend30.contractionScore ?? 0) > 0 || (sealedPriceMomentum ?? 50) > 55;
  const derivedDemand = calculateDemandScore({ components, behavioralEvidence });
  const demandConfidence = calculateDemandConfidence({ stores: distinctStores, products: productsObserved, historyDays, transitions: restocks.length + sellouts.length, priceObservations: confirmedPrices.length, monitorRuns30d });
  const manualDemand = latest(signals, (signal) => signal.signalType === "manual_demand" && signal.sourceType === "manual");
  const officialDemand = latest(signals, (signal) => signal.signalType === "demand_score" && signal.sourceType === "official");
  const externalDemand = latest(signals, (signal) => signal.signalType === "demand_score" && signal.sourceType === "external");
  const demandEffective = resolveEffectiveMarketMetric({ manual: manualDemand ? { value: manualDemand.value, confidence: manualDemand.confidence } : null, official: officialDemand ? { value: officialDemand.value, confidence: officialDemand.confidence } : null, external: externalDemand ? { value: externalDemand.value, confidence: externalDemand.confidence } : null, internal: derivedDemand === null ? null : { value: derivedDemand, confidence: demandConfidence } });
  const restocksByProduct = [...new Set(products.map((product) => product.id))].map((productId) => { const events = restocks.filter((event) => event.productId === productId); return { productId, restocks7d: countSince(events, now.getTime() - 7 * DAY_MS), restocks30d: countSince(events, now.getTime() - 30 * DAY_MS), restocks90d: countSince(events, now.getTime() - 90 * DAY_MS) }; }).filter((entry) => entry.restocks90d > 0);
  const selloutConfidence = calculateSelloutConfidence({ cycles: recentCycles.length, stores: new Set(recentCycles.map((cycle) => cycle.storeId)).size, products: new Set(recentCycles.map((cycle) => cycle.productId)).size, monitorRuns30d });

  const hypeAggregate = aggregateHypeSignals(signals, now);
  const manualHype = latest(signals, (signal) => signal.signalType === "manual_hype" && signal.sourceType === "manual");
  const officialHype = latest(signals, (signal) => (signal.signalType === "external_hype" || signal.signalType === "hype_score") && signal.sourceType === "official");
  const hasExternalHype = signals.some((signal) => (signal.signalType === "external_hype" || signal.signalType === "hype_score") && signal.sourceType === "external");
  const hypeEffective = resolveEffectiveMarketMetric({ manual: manualHype ? { value: calculateDecayedHypeValue(manualHype.value, manualHype.observedAt, now), confidence: manualHype.confidence } : null, official: officialHype ? { value: calculateDecayedHypeValue(officialHype.value, officialHype.observedAt, now), confidence: officialHype.confidence } : null, external: hasExternalHype && hypeAggregate.score !== null && hypeAggregate.confidence !== "INSUFFICIENT" ? { value: hypeAggregate.score, confidence: hypeAggregate.confidence } : null, internal: hypeAggregate.score === null ? null : { value: hypeAggregate.score, confidence: hypeAggregate.confidence } });
  const hypeSignals = signals.filter((signal) => signal.signalType === "manual_hype" || signal.signalType === "external_hype" || signal.signalType === "hype_score");

  const broadRestockStores = calculateBroadRestockStoreCount(restocks.filter((event) => new Date(event.observedAt).getTime() >= now.getTime() - 30 * DAY_MS));
  const reprintResult = calculateReprintRisk({ signals, availabilityExpansionScore: expansionScore, broadRestockStores, sealedPriceMomentum, releaseDate: set?.releaseDate ?? null, now });
  const explicitReprintSignals = signals.filter((signal) => signal.sourceType === "official" || signal.signalType === "manual_reprint_risk" || signal.confirmedReprint);
  const possibleSupplyExpansion = (expansionScore ?? 0) >= 20 || broadRestockStores >= 2;
  const explicitReprintSourceCount = new Set(explicitReprintSignals.map((signal) => signal.sourceKey ?? signal.sourceType)).size;
  const derivedReprintConfidence = calculateReprintConfidence({ confirmed: reprintResult.confirmed, explicitSignals: explicitReprintSourceCount, stores: distinctStores, broadRestockStores, historyDays, inferredEvidence: possibleSupplyExpansion });
  const manualReprintSignal = latest(explicitReprintSignals, (signal) => signal.signalType === "manual_reprint_risk" && signal.sourceType === "manual");
  const officialReprintSignal = latest(explicitReprintSignals, (signal) => signal.sourceType === "official");
  const reprintConfidence = reprintResult.confirmed ? "HIGH" as const : manualReprintSignal?.confidence ?? officialReprintSignal?.confidence ?? derivedReprintConfidence;
  const reprintSource = reprintResult.manualRisk !== null ? "manual" as const : explicitReprintSignals.some((signal) => signal.sourceType === "official") ? "official" as const : signals.some((signal) => reprintTypesForSource.has(signal.signalType) && signal.sourceType === "external") ? "external" as const : reprintResult.risk === null ? null : "derived" as const;
  const declaredReprintStatus = latest(explicitReprintSignals, (signal) => signal.reprintStatus !== null && signal.reprintStatus !== "UNKNOWN")?.reprintStatus ?? null;

  return {
    setId,
    demand: {
      score: demandEffective.value, derivedScore: derivedDemand, manualScore: manualDemand?.value ?? null, confidence: demandEffective.confidence, sourceType: demandEffective.sourceType,
      components, coverage: { monitoredStores: dataset.monitoredStores, storesWithSet: distinctStores, storesInStock, activeListings, productsObserved, monitorRuns30d },
      restocks7d, restocks30d, restocks90d, restocksByProduct, selloutCycles: recentCycles.length, medianSelloutHours, fastSelloutShare, selloutConfidence,
      availabilityChange7d: trend7.changePercent, availabilityChange30d: trend30.changePercent, historyDays,
      reasons: generateDemandReasons({ score: demandEffective.value, restocks30d, medianSelloutHours, availabilityChange30d: trend30.changePercent, sealedPriceMomentum }),
      warnings: generateMarketSignalWarnings({ confidence: demandEffective.confidence, stores: distinctStores, historyDays }),
    },
    hype: {
      score: hypeEffective.value, confidence: hypeEffective.confidence, sourceType: hypeEffective.sourceType, sourceCount: hypeAggregate.sourceCount,
      momentum: calculateHypeMomentum(hypeSignals), latestSignals: [...hypeSignals].sort((left, right) => right.observedAt.localeCompare(left.observedAt)).slice(0, 5),
      reasons: hypeEffective.value === null ? [] : [`${hypeAggregate.sourceCount} fuente${hypeAggregate.sourceCount === 1 ? "" : "s"} de hype normalizada${hypeAggregate.sourceCount === 1 ? "" : "s"}.`],
      warnings: generateMarketSignalWarnings({ confidence: hypeEffective.confidence, stores: distinctStores, historyDays }).filter((warning) => warning !== "Cobertura de una sola tienda."),
    },
    reprint: {
      risk: reprintResult.risk, derivedRisk: reprintResult.derivedRisk, manualRisk: reprintResult.manualRisk, safety: calculateReprintSafety(reprintResult.risk), confidence: reprintConfidence, sourceType: reprintSource,
      status: reprintResult.confirmed ? "CONFIRMED_REPRINT" : declaredReprintStatus ?? classifyReprintStatus(reprintResult.risk, false), confirmedReprint: reprintResult.confirmed, possibleSupplyExpansion, availabilityExpansionScore: expansionScore, broadRestockStores,
      confirmedSignals: signals.filter((signal) => signal.confirmedReprint), inferredSignals: signals.filter((signal) => !signal.confirmedReprint && (signal.sourceType === "internal" || signal.sourceType === "derived" || signal.signalType === "availability_expansion" || signal.signalType === "new_wave_detected")).slice(0, 10),
      reasons: generateReprintReasons({ confirmed: reprintResult.confirmed, expansionScore, broadRestockStores, releaseDate: set?.releaseDate ?? null }),
      warnings: generateMarketSignalWarnings({ confidence: reprintConfidence, stores: distinctStores, historyDays }),
    },
  };
}

export async function loadSetMarketIntelligence(client: SupabaseClient<Database>, userId: string, setIds: readonly string[], now = new Date(), repository: MarketSignalRepository = new SupabaseMarketSignalRepository(client, userId)): Promise<Map<string, SetMarketIntelligence>> {
  if (!setIds.length) return new Map();
  const dataset = await repository.load(setIds, new Date(now.getTime() - 90 * DAY_MS).toISOString());
  return new Map(setIds.map((setId) => [setId, calculateSetMarketIntelligence(dataset, setId, now)]));
}

export function marketIntelligenceToSetMetricSignals(intelligence: SetMarketIntelligence | null | undefined): SetMetricSignals {
  if (!intelligence) return { metrics: {}, provenance: {} };
  const metrics: SetMetricSignals["metrics"] = {};
  const provenance: SetMetricSignals["provenance"] = {};
  const add = (key: "demand" | "hype" | "reprintSafety", value: number | null, confidence: MarketSignalConfidence, sourceType: SetMarketIntelligence["demand"]["sourceType"], note: string) => {
    const storedConfidence = confidenceForProvenance(confidence);
    if (value === null || !storedConfidence || !sourceType) return;
    metrics[key] = value;
    provenance[key] = { sourceType, confidence: storedConfidence, sourceNote: note };
  };
  add("demand", intelligence.demand.score, intelligence.demand.confidence, intelligence.demand.sourceType, `Market Signals: ${intelligence.demand.restocks30d} reposiciones en 30d, ${intelligence.demand.coverage.storesWithSet} tiendas del set.`);
  add("hype", intelligence.hype.score, intelligence.hype.confidence, intelligence.hype.sourceType, `Market Signals: ${intelligence.hype.sourceCount} fuentes, momentum ${intelligence.hype.momentum.toLowerCase()}.`);
  add("reprintSafety", intelligence.reprint.safety, intelligence.reprint.confidence, intelligence.reprint.sourceType, `Market Signals: riesgo ${intelligence.reprint.risk}/100, estado ${intelligence.reprint.status}.`);
  return { metrics, provenance };
}
