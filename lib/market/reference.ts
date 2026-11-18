export type ComparisonBasis = "BASE_PRICE" | "TOTAL_ACQUISITION" | "INCOMPLETE";
export type MarketReferenceSource = "internal_market" | "external_market" | "manual" | "combined";
export type MarketReferenceConfidence = "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT";

export type CurrentMarketListing = {
  productId: string;
  listingId: string;
  storeId: string;
  priceCents: number;
  shippingCents: number | null;
  shippingKnown: boolean;
  stockStatus: string;
  observedAt: string;
};

export type MarketHistoryObservation = {
  productId: string;
  listingId: string;
  priceCents: number;
  shippingCents: number | null;
  shippingKnown: boolean;
  stockStatus: string;
  observedAt: string;
};

export type MarketReference = {
  productId: string;
  referencePriceCents: number;
  comparisonBasis: Exclude<ComparisonBasis, "INCOMPLETE">;
  source: MarketReferenceSource;
  confidence: Exclude<MarketReferenceConfidence, "INSUFFICIENT">;
  observedAt: string;
  components: {
    currentStores: number;
    sevenDayObservations: number;
    thirtyDayObservations: number;
    description: string;
  };
};

export type MarketReferenceResult = {
  reference: MarketReference | null;
  confidence: MarketReferenceConfidence;
  reason: string;
};

export type MarketReferenceRequest = { productId: string; currentListings: readonly CurrentMarketListing[]; history: readonly MarketHistoryObservation[]; now?: Date };

export interface MarketReferenceProvider {
  readonly source: MarketReferenceSource;
  calculate(input: MarketReferenceRequest): MarketReferenceResult;
}

const DAY_MS = 86_400_000;

export function calculateMedian(values: readonly number[]): number | null {
  const valid = values.filter((value) => Number.isInteger(value) && value > 0).sort((left, right) => left - right);
  if (valid.length === 0) return null;
  const middle = Math.floor(valid.length / 2);
  return valid.length % 2 === 1 ? valid[middle] : Math.round((valid[middle - 1] + valid[middle]) / 2);
}

function purchasable(status: string): boolean {
  return status === "in_stock" || status === "preorder";
}

function valueForBasis(value: { priceCents: number; shippingCents: number | null; shippingKnown: boolean }, basis: MarketReference["comparisonBasis"]): number | null {
  if (!Number.isInteger(value.priceCents) || value.priceCents <= 0) return null;
  if (basis === "BASE_PRICE") return value.priceCents;
  return value.shippingKnown && value.shippingCents !== null && value.shippingCents >= 0 ? value.priceCents + value.shippingCents : null;
}

function currentValuesByStore(listings: readonly CurrentMarketListing[], basis: MarketReference["comparisonBasis"]): number[] {
  const stores = new Map<string, number>();
  for (const listing of listings) {
    if (!purchasable(listing.stockStatus)) continue;
    const value = valueForBasis(listing, basis);
    if (value === null) continue;
    const existing = stores.get(listing.storeId);
    if (existing === undefined || value < existing) stores.set(listing.storeId, value);
  }
  return [...stores.values()];
}

function historicalValues(history: readonly MarketHistoryObservation[], basis: MarketReference["comparisonBasis"], earliest: number, now: number): number[] {
  return history.flatMap((entry) => {
    const timestamp = new Date(entry.observedAt).getTime();
    if (timestamp < earliest || timestamp > now || !purchasable(entry.stockStatus)) return [];
    const value = valueForBasis(entry, basis);
    return value === null ? [] : [value];
  });
}

function buildReference(productId: string, basis: MarketReference["comparisonBasis"], current: number[], sevenDay: number[], thirtyDay: number[], observedAt: string): MarketReferenceResult | null {
  let values: number[];
  let confidence: MarketReference["confidence"];
  let description: string;
  if (current.length >= 3) {
    values = current; confidence = "HIGH"; description = `${current.length} tiendas actuales`;
  } else if (current.length === 2) {
    values = current; confidence = "MEDIUM"; description = "2 tiendas actuales";
  } else if (current.length === 1 && sevenDay.length >= 3) {
    values = [...current, ...sevenDay]; confidence = "LOW"; description = `1 tienda + ${sevenDay.length} observaciones de 7d`;
  } else if (current.length === 0 && sevenDay.length >= 5) {
    values = sevenDay; confidence = "MEDIUM"; description = `${sevenDay.length} observaciones históricas de 7d`;
  } else if (current.length === 0 && thirtyDay.length >= 5) {
    values = thirtyDay; confidence = "LOW"; description = `${thirtyDay.length} observaciones históricas de 30d`;
  } else {
    return null;
  }
  const median = calculateMedian(values);
  if (median === null) return null;
  return {
    reference: { productId, referencePriceCents: median, comparisonBasis: basis, source: "internal_market", confidence, observedAt, components: { currentStores: current.length, sevenDayObservations: sevenDay.length, thirtyDayObservations: thirtyDay.length, description } },
    confidence,
    reason: description,
  };
}

export function calculateMarketReference(input: MarketReferenceRequest): MarketReferenceResult {
  const now = input.now ?? new Date();
  const timestamp = now.getTime();
  const current = input.currentListings.filter((listing) => listing.productId === input.productId);
  const history = input.history.filter((entry) => entry.productId === input.productId);
  for (const basis of ["TOTAL_ACQUISITION", "BASE_PRICE"] as const) {
    const currentValues = currentValuesByStore(current, basis);
    const sevenDay = historicalValues(history, basis, timestamp - 7 * DAY_MS, timestamp);
    const thirtyDay = historicalValues(history, basis, timestamp - 30 * DAY_MS, timestamp);
    const result = buildReference(input.productId, basis, currentValues, sevenDay, thirtyDay, now.toISOString());
    if (result) return result;
  }
  return { reference: null, confidence: "INSUFFICIENT", reason: "No hay suficientes precios comparables." };
}

export const internalMarketReferenceProvider: MarketReferenceProvider = { source: "internal_market", calculate: calculateMarketReference };

const confidenceWeight: Record<Exclude<MarketReferenceConfidence, "INSUFFICIENT">, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };

export function combineMarketReferences(productId: string, references: readonly MarketReference[], observedAt: string): MarketReferenceResult {
  const compatible = references.filter((reference) => reference.productId === productId);
  if (compatible.length === 0) return { reference: null, confidence: "INSUFFICIENT", reason: "No hay referencias para combinar." };
  const basis = compatible[0].comparisonBasis;
  if (!compatible.every((reference) => reference.comparisonBasis === basis)) return { reference: null, confidence: "INSUFFICIENT", reason: "Las referencias usan bases incompatibles." };
  const weight = compatible.reduce((total, reference) => total + confidenceWeight[reference.confidence], 0);
  const referencePriceCents = Math.round(compatible.reduce((total, reference) => total + reference.referencePriceCents * confidenceWeight[reference.confidence], 0) / weight);
  const confidence: MarketReference["confidence"] = compatible.some((reference) => reference.confidence === "HIGH") ? "HIGH" : compatible.some((reference) => reference.confidence === "MEDIUM") ? "MEDIUM" : "LOW";
  return { reference: { productId, referencePriceCents, comparisonBasis: basis, source: "combined", confidence, observedAt, components: { currentStores: 0, sevenDayObservations: 0, thirtyDayObservations: 0, description: `${compatible.length} referencias combinadas` } }, confidence, reason: `${compatible.length} referencias combinadas` };
}
