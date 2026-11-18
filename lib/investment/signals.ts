import { calculateMedian } from "@/lib/market/reference";

export function deriveSetPriceMomentum(recentPriceCents: readonly number[], previousPriceCents: readonly number[]): number | null {
  if (recentPriceCents.length < 3 || previousPriceCents.length < 3) return null;
  const recent = calculateMedian(recentPriceCents);
  const previous = calculateMedian(previousPriceCents);
  if (recent === null || previous === null || previous <= 0) return null;
  const changeBps = Math.max(-3_000, Math.min(3_000, Math.round(((recent - previous) * 10_000) / previous)));
  return Math.max(0, Math.min(100, 50 + Math.round(changeBps / 60)));
}

export function deriveSetScarcity(input: { distinctStores: number; storesInStock: number }): number | null {
  if (input.distinctStores < 3 || input.storesInStock < 0 || input.storesInStock > input.distinctStores) return null;
  return Math.round((1 - input.storesInStock / input.distinctStores) * 100);
}
