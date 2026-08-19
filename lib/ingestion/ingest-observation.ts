import { evaluateAlertCandidates } from "@/lib/alerts/evaluate-alerts";
import { calculateOpportunity } from "@/lib/finance/opportunity";
import { normalizeSourceKey, productIdentity } from "@/lib/normalization/identity";
import { normalizeDomain, normalizeListingUrl } from "@/lib/normalization/url";
import { normalizedListingObservationSchema, type NormalizedListingObservation } from "@/lib/monitors/types";
import type { IngestionRepository } from "./repository";
import type { IngestionResult } from "./types";

export async function ingestObservation(repository: IngestionRepository, raw: NormalizedListingObservation, options: { minimumPriceDropBasisPoints?: number } = {}): Promise<IngestionResult> {
  const observation = normalizedListingObservationSchema.parse(raw); const sourceKey = normalizeSourceKey(observation.source);
  const storeIdentity = { sourceKey, domain: normalizeDomain(observation.store.websiteUrl) }; let store = await repository.findStore(storeIdentity); const storeCreated = !store; store ??= await repository.createStore(storeIdentity, observation.store);
  const normalizedProductKey = productIdentity(observation.product); let product = await repository.findProduct(normalizedProductKey); const productCreated = !product; product ??= await repository.createProduct(normalizedProductKey, observation.product);
  const identity = { sourceKey, sourceProductId: observation.sourceProductId ?? null, canonicalUrl: normalizeListingUrl(observation.listing.url) }; let listing = await repository.findListing(identity, store.id); const listingCreated = !listing; const oldPrice = listing?.priceCents ?? null; const oldStock = listing?.stockStatus ?? null;
  let priceChanged = false; let stockChanged = false; let historyCreated = false;
  if (!listing) { listing = await repository.createListing(identity, product.id, store.id, observation); await repository.createPriceHistory(listing.id, observation); historyCreated = true; }
  else { priceChanged = listing.priceCents !== observation.listing.priceCents; stockChanged = listing.stockStatus !== observation.listing.stockStatus; await repository.updateListing(listing.id, observation); if (priceChanged || stockChanged) { await repository.createPriceHistory(listing.id, observation); historyCreated = true; } }
  const knownShippingCents = observation.listing.shippingKnown ? observation.listing.shippingCents : null;
  const evaluation = observation.financialAssumptions && knownShippingCents !== null ? calculateOpportunity({ ...observation.financialAssumptions, product_price_cents: observation.listing.priceCents, purchase_shipping_cents: knownShippingCents }) : null;
  const evaluationStatus = !observation.listing.shippingKnown ? "insufficient_cost_data" : evaluation ? "evaluated" : "insufficient_market_data";
  const targetPriceCents = listingCreated ? null : await repository.getActiveListingTargetPrice(listing.id);
  const candidates = !listingCreated && !priceChanged && !stockChanged ? [] : evaluateAlertCandidates({ productId: product.id, productName: observation.product.name, productType: observation.product.productType, tcg: observation.product.tcg, language: observation.product.language, storeId: store.id, storeName: observation.store.name, listingId: listing.id, listingUrl: observation.listing.url, oldPriceCents: oldPrice, oldStockStatus: oldStock, newPriceCents: observation.listing.priceCents, shippingCents: knownShippingCents, newStockStatus: observation.listing.stockStatus, targetPriceCents: targetPriceCents ?? undefined, minimumPriceDropBasisPoints: options.minimumPriceDropBasisPoints, evaluation: evaluation ?? undefined, isNewListing: listingCreated });
  return { store: { id: store.id, created: storeCreated }, product: { id: product.id, created: productCreated }, listing: { id: listing.id, created: listingCreated, priceChanged, stockChanged, historyCreated }, evaluationStatus, evaluation, alertCandidates: candidates };
}
