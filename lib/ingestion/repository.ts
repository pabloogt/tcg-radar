import type { NormalizedListingObservation } from "@/lib/monitors/types";
import type { HistoricalPricePoint } from "@/lib/analytics/price-history";
import type { CurrentMarketListing, MarketHistoryObservation, MarketReference } from "@/lib/market/reference";
import type { DealThresholds } from "@/lib/market/deal";
import type { DealAlertPreferences } from "@/lib/alerts/deal-alerts";
import type { StoredListing, StoredProduct, StoredStore } from "./types";
export type StoreIdentity = { sourceKey: string; domain: string };
export type ListingIdentity = { sourceKey: string; sourceProductId: string | null; canonicalUrl: string };
export type ProductMarketContext = { currentListings: CurrentMarketListing[]; history: MarketHistoryObservation[] };
export type UserDealConfiguration = { thresholds: DealThresholds; alerts: DealAlertPreferences };
export interface IngestionRepository {
  findStore(identity: StoreIdentity): Promise<StoredStore | null>;
  createStore(identity: StoreIdentity, observation: NormalizedListingObservation["store"]): Promise<StoredStore>;
  findProduct(normalizedKey: string): Promise<StoredProduct | null>;
  createProduct(normalizedKey: string, observation: NormalizedListingObservation["product"]): Promise<StoredProduct>;
  findListing(identity: ListingIdentity, storeId: string): Promise<StoredListing | null>;
  createListing(identity: ListingIdentity, productId: string, storeId: string, observation: NormalizedListingObservation): Promise<StoredListing>;
  updateListing(id: string, observation: NormalizedListingObservation): Promise<void>;
  createPriceHistory(listingId: string, observation: NormalizedListingObservation): Promise<void>;
  getProductPriceHistory(productId: string, since: string): Promise<HistoricalPricePoint[]>;
  getActiveListingTargetPrice(listingId: string): Promise<number | null>;
  getProductMarketContext(productId: string, since: string): Promise<ProductMarketContext>;
  getDealConfiguration(): Promise<UserDealConfiguration>;
  saveMarketReferenceSnapshot(reference: MarketReference): Promise<void>;
}
