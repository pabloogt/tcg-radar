import type { MarketSignalObservation, StockState } from "./types";

export type MarketSignalSet = { id: string; releaseDate: string | null };
export type MarketSignalProduct = { id: string; setId: string };
export type MarketSignalListing = { id: string; productId: string; storeId: string; sourceKey: string | null; stockStatus: StockState; checkedAt: string };
export type MarketSignalHistory = { listingId: string; priceCents: number; shippingCents: number | null; shippingKnown: boolean; stockStatus: StockState; recordedAt: string };
export type MarketSignalMonitorRun = { sourceKey: string; status: string; startedAt: string };

export type MarketSignalDataset = {
  sets: MarketSignalSet[];
  products: MarketSignalProduct[];
  listings: MarketSignalListing[];
  history: MarketSignalHistory[];
  signals: MarketSignalObservation[];
  monitorRuns: MarketSignalMonitorRun[];
  monitoredStores: number;
};

export interface MarketSignalRepository {
  load(setIds: readonly string[], since: string): Promise<MarketSignalDataset>;
}
