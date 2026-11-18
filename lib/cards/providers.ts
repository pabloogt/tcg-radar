export type NormalizedCardRecord = {
  externalId: string | null;
  name: string;
  cardNumber: string;
  rarity: string;
  rarityGroup: "common" | "uncommon" | "rare" | "ultra" | "special" | "secret" | "promo" | "other" | null;
  imageUrl: string | null;
  characterName: string | null;
  variantName: string | null;
};

export type NormalizedCardPriceRecord = {
  externalId: string | null;
  cardNumber: string | null;
  variantName: string | null;
  source: string;
  currency: string;
  marketPriceCents: number | null;
  lowPriceCents: number | null;
  trendPriceCents: number | null;
  observedAt: string;
  sourceMetadata: Record<string, string | number | boolean | null>;
};

export interface CardDataProvider {
  readonly sourceKey: string;
  loadCards(setExternalId: string): Promise<NormalizedCardRecord[]>;
}

export interface CardPriceProvider {
  readonly sourceKey: string;
  loadPrices(cards: readonly NormalizedCardRecord[]): Promise<NormalizedCardPriceRecord[]>;
}
