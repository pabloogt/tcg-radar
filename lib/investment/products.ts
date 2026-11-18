import type { DealClassification } from "@/lib/market/deal";

export type SetProductCandidate = { id: string; setId: string | null; language: string; productType: string; activeListings: number; purchasableListings: number; dealClassification: DealClassification | null; lowestConfirmedTotalCents: number | null };
const dealRank: Record<DealClassification, number> = { CHOLLO: 0, OPPORTUNITY: 1, GOOD_PRICE: 2, NORMAL: 3, EXPENSIVE: 4 };

export function productsForSet<T extends { setId: string | null }>(products: readonly T[], setId: string): T[] { return products.filter((product) => product.setId === setId); }
export function sortSetProducts<T extends SetProductCandidate>(products: readonly T[]): T[] {
  return [...products].sort((left, right) => Number(right.activeListings > 0) - Number(left.activeListings > 0) || Number(right.purchasableListings > 0) - Number(left.purchasableListings > 0) || (left.dealClassification ? dealRank[left.dealClassification] : 5) - (right.dealClassification ? dealRank[right.dealClassification] : 5) || (left.lowestConfirmedTotalCents ?? Number.POSITIVE_INFINITY) - (right.lowestConfirmedTotalCents ?? Number.POSITIVE_INFINITY));
}
