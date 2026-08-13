import type { NormalizedListingObservation } from "@/lib/monitors/types";
import type { StoredListing, StoredProduct, StoredStore } from "./types";
export type StoreIdentity = { sourceKey: string; domain: string };
export type ListingIdentity = { sourceKey: string; sourceProductId: string | null; canonicalUrl: string };
export interface IngestionRepository {
  findStore(identity: StoreIdentity): Promise<StoredStore | null>;
  createStore(identity: StoreIdentity, observation: NormalizedListingObservation["store"]): Promise<StoredStore>;
  findProduct(normalizedKey: string): Promise<StoredProduct | null>;
  createProduct(normalizedKey: string, observation: NormalizedListingObservation["product"]): Promise<StoredProduct>;
  findListing(identity: ListingIdentity, storeId: string): Promise<StoredListing | null>;
  createListing(identity: ListingIdentity, productId: string, storeId: string, observation: NormalizedListingObservation): Promise<StoredListing>;
  updateListing(id: string, observation: NormalizedListingObservation): Promise<void>;
  createPriceHistory(listingId: string, observation: NormalizedListingObservation): Promise<void>;
  getActiveListingTargetPrice(listingId: string): Promise<number | null>;
}
