export const PURCHASABLE_STOCK = new Set(["in_stock", "preorder"]);

export type ComparableListing = {
  id: string;
  storeId: string;
  priceCents: number;
  shippingCents: number;
  shippingKnown: boolean;
  stockStatus: string;
  checkedAt: string;
};

export type HistoricalPricePoint = {
  listingId: string;
  priceCents: number;
  shippingCents: number | null;
  shippingKnown: boolean;
  stockStatus: string;
  recordedAt: string;
};

export type PriceStats = { minimumCents: number; maximumCents: number; averageCents: number };
export type PeriodStatistics = {
  observations: number;
  productPrice: PriceStats | null;
  confirmedTotal: PriceStats | null;
};

export type AggregatedHistoryPoint = {
  date: string;
  cents: number;
  kind: "confirmed_total" | "product_price_only";
};

export type NewLowResult = {
  new7DayLow: boolean;
  previous7DayMinimumCents: number | null;
  new30DayLow: boolean;
  previous30DayMinimumCents: number | null;
};

const STOCK_ORDER: Record<string, number> = { in_stock: 0, preorder: 1, unknown: 2, out_of_stock: 3 };

export function isPurchasable(stockStatus: string): boolean {
  return PURCHASABLE_STOCK.has(stockStatus);
}

export function confirmedTotalCents(value: { priceCents: number; shippingCents: number | null; shippingKnown: boolean }): number | null {
  return value.shippingKnown && value.shippingCents !== null ? value.priceCents + value.shippingCents : null;
}

export function sortListingsForComparison<T extends ComparableListing>(listings: readonly T[]): T[] {
  return [...listings].sort((left, right) => {
    const stockDifference = (STOCK_ORDER[left.stockStatus] ?? 4) - (STOCK_ORDER[right.stockStatus] ?? 4);
    if (stockDifference !== 0) return stockDifference;
    if (left.shippingKnown !== right.shippingKnown) return left.shippingKnown ? -1 : 1;
    const leftCost = left.shippingKnown ? left.priceCents + left.shippingCents : left.priceCents;
    const rightCost = right.shippingKnown ? right.priceCents + right.shippingCents : right.priceCents;
    return leftCost - rightCost || right.checkedAt.localeCompare(left.checkedAt);
  });
}

export function summarizeCurrentListings<T extends ComparableListing>(listings: readonly T[]) {
  const purchasable = listings.filter((listing) => isPurchasable(listing.stockStatus));
  const confirmed = purchasable.filter((listing) => listing.shippingKnown);
  const bestConfirmed = confirmed.reduce<T | null>((best, listing) => !best || listing.priceCents + listing.shippingCents < best.priceCents + best.shippingCents ? listing : best, null);
  const lowestBase = purchasable.reduce<T | null>((best, listing) => !best || listing.priceCents < best.priceCents ? listing : best, null);
  return {
    bestConfirmed,
    lowestBase,
    activeListings: purchasable.length,
    storesInStock: new Set(listings.filter((listing) => listing.stockStatus === "in_stock").map((listing) => listing.storeId)).size,
  };
}

function stats(values: number[]): PriceStats | null {
  if (values.length === 0) return null;
  return {
    minimumCents: Math.min(...values),
    maximumCents: Math.max(...values),
    averageCents: Math.round(values.reduce((total, value) => total + value, 0) / values.length),
  };
}

export function calculatePeriodStatistics(points: readonly HistoricalPricePoint[], now: Date, durationMilliseconds: number): PeriodStatistics {
  const earliest = now.getTime() - durationMilliseconds;
  const relevant = points.filter((point) => {
    const timestamp = new Date(point.recordedAt).getTime();
    return timestamp >= earliest && timestamp <= now.getTime();
  });
  const confirmedTotals = relevant.flatMap((point) => {
    const total = confirmedTotalCents(point);
    return isPurchasable(point.stockStatus) && total !== null ? [total] : [];
  });
  return { observations: relevant.length, productPrice: stats(relevant.map((point) => point.priceCents)), confirmedTotal: stats(confirmedTotals) };
}

export function aggregateDailyBestPrice(points: readonly HistoricalPricePoint[]): AggregatedHistoryPoint[] {
  const byDate = new Map<string, HistoricalPricePoint[]>();
  for (const point of points) {
    if (!isPurchasable(point.stockStatus)) continue;
    const date = point.recordedAt.slice(0, 10);
    byDate.set(date, [...(byDate.get(date) ?? []), point]);
  }
  return [...byDate.entries()].sort(([left], [right]) => left.localeCompare(right)).map<AggregatedHistoryPoint>(([date, daily]) => {
    const confirmed = daily.flatMap((point) => {
      const total = confirmedTotalCents(point);
      return total === null ? [] : [total];
    });
    if (confirmed.length > 0) return { date, cents: Math.min(...confirmed), kind: "confirmed_total" };
    return { date, cents: Math.min(...daily.map((point) => point.priceCents)), kind: "product_price_only" };
  });
}

function previousConfirmedMinimum(points: readonly HistoricalPricePoint[], now: Date, days: number): number | null {
  const summary = calculatePeriodStatistics(points, now, days * 24 * 60 * 60 * 1_000);
  return summary.confirmedTotal?.minimumCents ?? null;
}

export function detectNewPriceLows(current: HistoricalPricePoint, previousPoints: readonly HistoricalPricePoint[], now = new Date(current.recordedAt)): NewLowResult {
  const currentTotal = isPurchasable(current.stockStatus) ? confirmedTotalCents(current) : null;
  const previous7 = previousConfirmedMinimum(previousPoints, now, 7);
  const previous30 = previousConfirmedMinimum(previousPoints, now, 30);
  return {
    new7DayLow: currentTotal !== null && previous7 !== null && currentTotal < previous7,
    previous7DayMinimumCents: previous7,
    new30DayLow: currentTotal !== null && previous30 !== null && currentTotal < previous30,
    previous30DayMinimumCents: previous30,
  };
}
