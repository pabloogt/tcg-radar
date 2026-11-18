import { confidenceWeights, DAY_MS, defaultHypeProviderWeights, demandComponentWeights, HYPE_HALF_LIFE_DAYS, hypeSourceWeights, reprintComponentWeights } from "./config";
import type { DemandComponents, HypeMomentum, MarketSignalConfidence, MarketSignalObservation, MarketSignalSourceType, ReprintStatus, RestockEvent, SelloutCycle, SelloutEvent, StockObservation, StockTransition } from "./types";

const purchasableStates = new Set(["in_stock", "preorder"]);
const hypeTypes = new Set(["manual_hype", "external_hype", "hype_score"]);
const reprintTypes = new Set(["reprint_event", "reprint_risk", "manual_reprint_risk", "official_reprint_announced", "official_restock_announced", "large_supply_return", "new_wave_detected", "availability_expansion", "distributor_signal", "set_out_of_print", "production_window_closed", "unknown_supply_status"]);

export function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function timestamp(value: string): number | null {
  const result = new Date(value).getTime();
  return Number.isFinite(result) ? result : null;
}

function normalizedTimelines(observations: readonly StockObservation[]): StockObservation[][] {
  const grouped = new Map<string, { observation: StockObservation; index: number }[]>();
  observations.forEach((observation, index) => {
    if (timestamp(observation.observedAt) === null) return;
    grouped.set(observation.listingId, [...(grouped.get(observation.listingId) ?? []), { observation, index }]);
  });
  return [...grouped.values()].map((entries) => {
    const ordered = [...entries].sort((left, right) => timestamp(left.observation.observedAt)! - timestamp(right.observation.observedAt)! || left.index - right.index);
    return ordered.reduce<StockObservation[]>((timeline, entry) => timeline.at(-1)?.stockStatus === entry.observation.stockStatus ? timeline : [...timeline, entry.observation], []);
  });
}

export function calculateRestockEvents(observations: readonly StockObservation[]): RestockEvent[] {
  return normalizedTimelines(observations).flatMap((timeline) => timeline.flatMap((observation, index) => {
    const previous = timeline[index - 1];
    return previous?.stockStatus === "out_of_stock" && observation.stockStatus === "in_stock" ? [{ ...observation, previousStatus: "out_of_stock" as const }] : [];
  })).sort((left, right) => left.observedAt.localeCompare(right.observedAt) || left.listingId.localeCompare(right.listingId));
}

export function calculateSelloutEvents(observations: readonly StockObservation[]): SelloutEvent[] {
  return normalizedTimelines(observations).flatMap((timeline) => timeline.flatMap((observation, index) => {
    const previous = timeline[index - 1];
    return previous?.stockStatus === "in_stock" && observation.stockStatus === "out_of_stock" ? [{ ...observation, previousStatus: "in_stock" as const }] : [];
  })).sort((left, right) => left.observedAt.localeCompare(right.observedAt) || left.listingId.localeCompare(right.listingId));
}

export function calculateStockTransitions(observations: readonly StockObservation[]): StockTransition[] {
  return normalizedTimelines(observations).flatMap((timeline) => timeline.slice(1).map((observation, index) => {
    const previousStatus = timeline[index].stockStatus;
    const transitionType = previousStatus === "out_of_stock" && observation.stockStatus === "in_stock" ? "RESTOCK" as const : previousStatus === "in_stock" && observation.stockStatus === "out_of_stock" ? "SELLOUT" as const : previousStatus === "preorder" && observation.stockStatus === "in_stock" ? "RELEASE" as const : "OTHER" as const;
    return { ...observation, previousStatus, transitionType };
  })).sort((left, right) => left.observedAt.localeCompare(right.observedAt) || left.listingId.localeCompare(right.listingId));
}

export function calculateSelloutCycles(observations: readonly StockObservation[]): SelloutCycle[] {
  const cycles: SelloutCycle[] = [];
  for (const timeline of normalizedTimelines(observations)) {
    let restock: StockObservation | null = null;
    for (let index = 1; index < timeline.length; index += 1) {
      const previous = timeline[index - 1];
      const current = timeline[index];
      if (previous.stockStatus === "out_of_stock" && current.stockStatus === "in_stock") restock = current;
      else if (restock && previous.stockStatus === "in_stock" && current.stockStatus === "out_of_stock") {
        const duration = timestamp(current.observedAt)! - timestamp(restock.observedAt)!;
        if (duration >= 0) cycles.push({ listingId: current.listingId, productId: current.productId, storeId: current.storeId, restockedAt: restock.observedAt, soldOutAt: current.observedAt, durationHours: Math.round(duration / 36_000) / 100 });
        restock = null;
      }
    }
  }
  return cycles.sort((left, right) => left.soldOutAt.localeCompare(right.soldOutAt) || left.listingId.localeCompare(right.listingId));
}

export function calculateMedianSelloutTime(cycles: readonly SelloutCycle[]): number | null {
  const minutes = cycles.flatMap((cycle) => Number.isFinite(cycle.durationHours) && cycle.durationHours >= 0 ? [Math.round(cycle.durationHours * 60)] : []).sort((left, right) => left - right);
  if (!minutes.length) return null;
  const middle = Math.floor(minutes.length / 2);
  const median = minutes.length % 2 ? minutes[middle] : Math.round((minutes[middle - 1] + minutes[middle]) / 2);
  return Math.round((median / 60) * 100) / 100;
}

export function calculateAvailabilityContraction(currentAvailable: number, previousAvailable: number): number | null {
  if (!Number.isInteger(currentAvailable) || !Number.isInteger(previousAvailable) || currentAvailable < 0 || previousAvailable <= 0) return null;
  return clampScore(((previousAvailable - currentAvailable) * 100) / previousAvailable);
}

export function calculateAvailabilityExpansion(currentAvailable: number, previousAvailable: number): number | null {
  if (!Number.isInteger(currentAvailable) || !Number.isInteger(previousAvailable) || currentAvailable < 0 || previousAvailable <= 0) return null;
  return clampScore(((currentAvailable - previousAvailable) * 100) / previousAvailable);
}

function statesAt(observations: readonly StockObservation[], at: number): Map<string, StockObservation> {
  const states = new Map<string, StockObservation>();
  for (const observation of observations) {
    const time = timestamp(observation.observedAt);
    if (time === null || time > at) continue;
    const previous = states.get(observation.listingId);
    if (!previous || timestamp(previous.observedAt)! <= time) states.set(observation.listingId, observation);
  }
  return states;
}

export function calculateAvailabilityTrend(observations: readonly StockObservation[], now: Date, days: number): { current: number; previous: number; comparableListings: number; changePercent: number | null; contractionScore: number | null; expansionScore: number | null } {
  const currentStates = new Map([...statesAt(observations, now.getTime())].filter(([, observation]) => timestamp(observation.observedAt)! >= now.getTime() - 7 * DAY_MS));
  const previousStates = statesAt(observations, now.getTime() - days * DAY_MS);
  const comparableIds = [...previousStates.keys()].filter((id) => currentStates.has(id));
  const current = comparableIds.filter((id) => purchasableStates.has(currentStates.get(id)!.stockStatus)).length;
  const previous = comparableIds.filter((id) => purchasableStates.has(previousStates.get(id)!.stockStatus)).length;
  if (comparableIds.length < 2 || previous === 0) return { current, previous, comparableListings: comparableIds.length, changePercent: null, contractionScore: null, expansionScore: null };
  return { current, previous, comparableListings: comparableIds.length, changePercent: Math.round(((current - previous) * 10_000) / previous) / 100, contractionScore: calculateAvailabilityContraction(current, previous), expansionScore: calculateAvailabilityExpansion(current, previous) };
}

export function calculateRestockActivityScore(restocks30d: number, productsObserved: number): number | null {
  if (productsObserved <= 0 || restocks30d < 0) return null;
  const perProduct = restocks30d / productsObserved;
  if (perProduct === 0) return 20;
  if (perProduct < 0.5) return 45;
  if (perProduct < 1) return 60;
  if (perProduct < 2) return 75;
  return 90;
}

export function calculateSelloutSpeedScore(medianHours: number | null, fastSelloutShare: number | null): number | null {
  if (medianHours === null || fastSelloutShare === null) return null;
  const durationScore = medianHours <= 6 ? 95 : medianHours <= 24 ? 85 : medianHours <= 72 ? 70 : medianHours <= 168 ? 55 : 35;
  return clampScore(durationScore * 0.75 + fastSelloutShare * 100 * 0.25);
}

export function calculateSelloutConfidence(input: { cycles: number; stores: number; products: number; monitorRuns30d: number }): MarketSignalConfidence {
  if (input.cycles >= 6 && input.stores >= 3 && input.products >= 3 && input.monitorRuns30d >= 20) return "HIGH";
  if (input.cycles >= 3 && input.stores >= 2 && input.products >= 2 && input.monitorRuns30d >= 8) return "MEDIUM";
  if (input.cycles >= 1) return "LOW";
  return "INSUFFICIENT";
}

export function calculateDemandScore(input: { components: DemandComponents; behavioralEvidence: boolean }): number | null {
  const entries = (Object.keys(demandComponentWeights) as (keyof DemandComponents)[]).flatMap((key) => input.components[key] === null ? [] : [{ value: input.components[key]!, weight: demandComponentWeights[key] }]);
  if (!entries.length) return null;
  const totalWeight = entries.reduce((total, entry) => total + entry.weight, 0);
  const raw = entries.reduce((total, entry) => total + entry.value * entry.weight, 0) / totalWeight;
  return clampScore(input.behavioralEvidence ? raw : Math.min(raw, 60));
}

export function calculateDemandConfidence(input: { stores: number; products: number; historyDays: number; transitions: number; priceObservations: number; monitorRuns30d?: number }): MarketSignalConfidence {
  const points = (input.stores >= 4 ? 30 : input.stores >= 2 ? 20 : input.stores === 1 ? 8 : 0)
    + (input.products >= 4 ? 20 : input.products >= 2 ? 12 : input.products === 1 ? 5 : 0)
    + (input.historyDays >= 30 ? 25 : input.historyDays >= 7 ? 15 : input.historyDays > 0 ? 5 : 0)
    + (input.transitions >= 6 ? 15 : input.transitions >= 2 ? 10 : input.transitions === 1 ? 5 : 0)
    + (input.priceObservations >= 10 ? 10 : input.priceObservations >= 4 ? 6 : 0)
    + ((input.monitorRuns30d ?? 0) >= 20 ? 10 : (input.monitorRuns30d ?? 0) >= 4 ? 6 : (input.monitorRuns30d ?? 0) > 0 ? 3 : 0);
  if (input.stores < 2) return points >= 30 ? "LOW" : "INSUFFICIENT";
  if (points >= 80) return "HIGH";
  if (points >= 55) return "MEDIUM";
  if (points >= 30) return "LOW";
  return "INSUFFICIENT";
}

export function applyHypeDecay(observedAt: string, now: Date, halfLifeDays = HYPE_HALF_LIFE_DAYS): number {
  const observed = timestamp(observedAt);
  if (observed === null || halfLifeDays <= 0) return 0;
  const ageDays = Math.max(0, (now.getTime() - observed) / DAY_MS);
  return 2 ** (-ageDays / halfLifeDays);
}

export function calculateDecayedHypeValue(value: number, observedAt: string, now: Date): number {
  const decay = applyHypeDecay(observedAt, now);
  return clampScore(50 + (clampScore(value) - 50) * decay);
}

function hypeSignalWeight(signal: MarketSignalObservation, now: Date, providerWeights: Readonly<Record<string, number>>): number {
  const providerWeight = signal.sourceKey ? providerWeights[signal.sourceKey] ?? 100 : 100;
  return hypeSourceWeights[signal.sourceType] * providerWeight / 100 * confidenceWeights[signal.confidence] * applyHypeDecay(signal.observedAt, now);
}

export function aggregateHypeSignals(signals: readonly MarketSignalObservation[], now: Date, providerWeights: Readonly<Record<string, number>> = defaultHypeProviderWeights): { score: number | null; confidence: MarketSignalConfidence; sourceCount: number } {
  const eligible = signals.filter((signal) => hypeTypes.has(signal.signalType) && timestamp(signal.observedAt) !== null && timestamp(signal.observedAt)! <= now.getTime());
  const weighted = eligible.map((signal) => ({ signal, weight: hypeSignalWeight(signal, now, providerWeights) })).filter((entry) => entry.weight > 0);
  if (!weighted.length) return { score: null, confidence: "INSUFFICIENT", sourceCount: 0 };
  const totalWeight = weighted.reduce((total, entry) => total + entry.weight, 0);
  const score = clampScore(weighted.reduce((total, entry) => total + calculateDecayedHypeValue(entry.signal.value, entry.signal.observedAt, now) * entry.weight, 0) / totalWeight);
  const sourceCount = new Set(weighted.map((entry) => entry.signal.sourceKey ?? entry.signal.sourceType)).size;
  const recent = weighted.filter((entry) => applyHypeDecay(entry.signal.observedAt, now) >= 0.5);
  const confidence: MarketSignalConfidence = recent.some((entry) => entry.signal.sourceType === "official" && entry.signal.confidence === "HIGH") || sourceCount >= 3 && recent.length >= 3 ? "HIGH" : sourceCount >= 2 || recent.some((entry) => entry.signal.confidence !== "LOW") ? "MEDIUM" : "LOW";
  return { score, confidence, sourceCount };
}

export function calculateHypeMomentum(signals: readonly MarketSignalObservation[]): HypeMomentum {
  const ordered = signals.filter((signal) => hypeTypes.has(signal.signalType) && timestamp(signal.observedAt) !== null).sort((left, right) => left.observedAt.localeCompare(right.observedAt));
  if (ordered.length < 3 || timestamp(ordered.at(-1)!.observedAt)! - timestamp(ordered[0].observedAt)! < 7 * DAY_MS) return "INSUFFICIENT";
  const middle = Math.floor(ordered.length / 2);
  const first = ordered.slice(0, middle);
  const second = ordered.slice(middle);
  const mean = (values: readonly MarketSignalObservation[]) => values.reduce((total, value) => total + value.value, 0) / values.length;
  const difference = mean(second) - mean(first);
  return difference >= 5 ? "RISING" : difference <= -5 ? "FALLING" : "STABLE";
}

export function calculateBroadRestockStoreCount(events: readonly RestockEvent[], windowHours = 24): number {
  if (!events.length) return 0;
  const sorted = [...events].sort((left, right) => left.observedAt.localeCompare(right.observedAt));
  let maximum = 0;
  for (let index = 0; index < sorted.length; index += 1) {
    const start = timestamp(sorted[index].observedAt)!;
    const stores = new Set(sorted.slice(index).filter((event) => timestamp(event.observedAt)! - start <= windowHours * 3_600_000).map((event) => event.storeId));
    maximum = Math.max(maximum, stores.size);
  }
  return maximum;
}

export function calculateSetLifecycleReprintRisk(releaseDate: string | null, now: Date): number | null {
  if (!releaseDate) return null;
  const released = timestamp(`${releaseDate}T00:00:00Z`);
  if (released === null) return null;
  const ageDays = Math.max(0, (now.getTime() - released) / DAY_MS);
  return ageDays < 180 ? 80 : ageDays < 365 ? 65 : ageDays < 730 ? 40 : ageDays < 1_095 ? 25 : 15;
}

function weightedSignalScore(signals: readonly MarketSignalObservation[]): number | null {
  if (!signals.length) return null;
  const entries = signals.map((signal) => ({ value: signal.value, weight: confidenceWeights[signal.confidence] * (signal.sourceType === "official" ? 1.25 : 1) }));
  return clampScore(entries.reduce((total, entry) => total + entry.value * entry.weight, 0) / entries.reduce((total, entry) => total + entry.weight, 0));
}

export function calculateReprintRisk(input: { signals: readonly MarketSignalObservation[]; availabilityExpansionScore: number | null; broadRestockStores: number; sealedPriceMomentum: number | null; releaseDate: string | null; now: Date }): { risk: number | null; derivedRisk: number | null; manualRisk: number | null; confirmed: boolean } {
  const signals = input.signals.filter((signal) => reprintTypes.has(signal.signalType));
  const confirmed = signals.some((signal) => signal.confirmedReprint && (signal.sourceType === "official" || signal.sourceType === "manual"));
  const manual = [...signals].filter((signal) => signal.signalType === "manual_reprint_risk" && signal.sourceType === "manual").sort((left, right) => right.observedAt.localeCompare(left.observedAt))[0];
  const explicit = weightedSignalScore(signals.filter((signal) => signal.sourceType === "official" || signal.signalType === "manual_reprint_risk" || signal.signalType === "set_out_of_print" || signal.signalType === "production_window_closed"));
  const simultaneousRestocks = input.broadRestockStores >= 4 ? 90 : input.broadRestockStores === 3 ? 75 : input.broadRestockStores === 2 ? 50 : input.broadRestockStores === 1 ? 20 : null;
  const sealedPricePressure = input.sealedPriceMomentum === null ? null : clampScore(100 - input.sealedPriceMomentum);
  const lifecycle = calculateSetLifecycleReprintRisk(input.releaseDate, input.now);
  const values: { value: number; weight: number }[] = [];
  if (explicit !== null) values.push({ value: explicit, weight: reprintComponentWeights.explicitSignals });
  if (input.availabilityExpansionScore !== null) values.push({ value: input.availabilityExpansionScore, weight: reprintComponentWeights.availabilityExpansion });
  if (simultaneousRestocks !== null) values.push({ value: simultaneousRestocks, weight: reprintComponentWeights.simultaneousRestocks });
  if (sealedPricePressure !== null) values.push({ value: sealedPricePressure, weight: reprintComponentWeights.sealedPricePressure });
  if (lifecycle !== null) values.push({ value: lifecycle, weight: reprintComponentWeights.setLifecycle });
  if (input.availabilityExpansionScore !== null) values.push({ value: input.availabilityExpansionScore, weight: reprintComponentWeights.supplyTrend });
  const rawDerivedRisk = values.length ? clampScore(values.reduce((total, entry) => total + entry.value * entry.weight, 0) / values.reduce((total, entry) => total + entry.weight, 0)) : null;
  const derivedRisk = rawDerivedRisk === null ? null : explicit === null && input.broadRestockStores < 2 && input.availabilityExpansionScore !== null ? Math.min(60, rawDerivedRisk) : rawDerivedRisk;
  const manualRisk = manual?.value ?? null;
  const selected = manualRisk ?? derivedRisk;
  return { risk: selected === null ? null : confirmed ? Math.max(90, selected) : selected, derivedRisk, manualRisk, confirmed };
}

export function calculateReprintSafety(risk: number | null): number | null {
  return risk === null ? null : 100 - clampScore(risk);
}

export function calculateReprintConfidence(input: { confirmed: boolean; explicitSignals: number; stores: number; broadRestockStores: number; historyDays: number; inferredEvidence: boolean }): MarketSignalConfidence {
  if (input.confirmed) return "HIGH";
  if (input.explicitSignals >= 2 || input.stores >= 4 && input.broadRestockStores >= 3 && input.historyDays >= 30) return "MEDIUM";
  if (input.explicitSignals >= 1 || input.inferredEvidence && input.stores >= 2) return "LOW";
  return "INSUFFICIENT";
}

export function classifyReprintStatus(risk: number | null, confirmed: boolean): ReprintStatus {
  if (confirmed) return "CONFIRMED_REPRINT";
  if (risk === null) return "UNKNOWN";
  if (risk >= 70) return "HIGH_RISK";
  if (risk >= 40) return "MODERATE_RISK";
  return "LOW_RISK";
}

export function resolveEffectiveMarketMetric(input: { manual: { value: number; confidence: Exclude<MarketSignalConfidence, "INSUFFICIENT"> } | null; official: { value: number; confidence: Exclude<MarketSignalConfidence, "INSUFFICIENT"> } | null; external?: { value: number; confidence: Exclude<MarketSignalConfidence, "INSUFFICIENT"> } | null; internal: { value: number; confidence: MarketSignalConfidence } | null }): { value: number | null; sourceType: MarketSignalSourceType | null; confidence: MarketSignalConfidence } {
  if (input.manual) return { value: input.manual.value, sourceType: "manual", confidence: input.manual.confidence };
  const internal = input.internal;
  const candidates = [input.official ? { ...input.official, sourceType: "official" as const, priority: 3 } : null, input.external ? { ...input.external, sourceType: "external" as const, priority: 2 } : null, internal && internal.confidence !== "INSUFFICIENT" ? { ...internal, confidence: internal.confidence, sourceType: "derived" as const, priority: 1 } : null].filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null).sort((left, right) => confidenceWeights[right.confidence] - confidenceWeights[left.confidence] || right.priority - left.priority);
  const selected = candidates[0];
  if (selected) return { value: selected.value, sourceType: selected.sourceType, confidence: selected.confidence };
  return { value: input.internal?.value ?? null, sourceType: input.internal ? "derived" : null, confidence: "INSUFFICIENT" };
}

export function generateDemandReasons(input: { score: number | null; restocks30d: number; medianSelloutHours: number | null; availabilityChange30d: number | null; sealedPriceMomentum: number | null }): string[] {
  const reasons: string[] = [];
  if (input.restocks30d > 0) reasons.push(`${input.restocks30d} reposiciones detectadas en 30 días.`);
  if (input.medianSelloutHours !== null) reasons.push(`Agotamiento mediano detectado en ~${input.medianSelloutHours.toLocaleString("es-ES", { maximumFractionDigits: 1 })} h.`);
  if (input.availabilityChange30d !== null && input.availabilityChange30d < 0) reasons.push(`Disponibilidad ${Math.abs(input.availabilityChange30d).toLocaleString("es-ES")} % menor frente a 30 días.`);
  if (input.sealedPriceMomentum !== null && input.sealedPriceMomentum > 55) reasons.push("Presión positiva moderada en precios sellados.");
  if (input.score !== null && !reasons.length) reasons.push("Señal basada en presión de stock con evidencia limitada.");
  return reasons;
}

export function generateReprintReasons(input: { confirmed: boolean; expansionScore: number | null; broadRestockStores: number; releaseDate: string | null }): string[] {
  const reasons: string[] = [];
  if (input.confirmed) reasons.push("Existe una señal de reimpresión confirmada introducida manualmente u oficialmente.");
  if (input.expansionScore !== null && input.expansionScore >= 20) reasons.push(`Expansión de disponibilidad estimada en ${input.expansionScore}/100.`);
  if (input.broadRestockStores >= 2) reasons.push(`Reposiciones cercanas detectadas en ${input.broadRestockStores} tiendas.`);
  if (input.releaseDate) reasons.push("La fase de vida del set se usa solo como señal secundaria.");
  return reasons;
}

export function generateMarketSignalWarnings(input: { confidence: MarketSignalConfidence; stores: number; historyDays: number }): string[] {
  const warnings: string[] = [];
  if (input.confidence === "INSUFFICIENT") warnings.push("Datos insuficientes.");
  else if (input.confidence === "LOW") warnings.push("Señal con confianza baja.");
  if (input.stores < 2) warnings.push("Cobertura de una sola tienda.");
  if (input.historyDays < 30) warnings.push("Histórico inferior a 30 días.");
  return warnings;
}
