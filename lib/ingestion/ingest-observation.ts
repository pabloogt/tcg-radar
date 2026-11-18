import { createDealAlertCandidate } from "@/lib/alerts/deal-alerts";
import { evaluateAlertCandidates } from "@/lib/alerts/evaluate-alerts";
import { detectNewPriceLows, isPurchasable, type HistoricalPricePoint } from "@/lib/analytics/price-history";
import { calculateOpportunity } from "@/lib/finance/opportunity";
import { evaluateDeal } from "@/lib/market/deal";
import { calculateMarketReference, type CurrentMarketListing } from "@/lib/market/reference";
import { normalizeSourceKey, productIdentity } from "@/lib/normalization/identity";
import { normalizeDomain, normalizeListingUrl } from "@/lib/normalization/url";
import { normalizedListingObservationSchema, type NormalizedListingObservation } from "@/lib/monitors/types";
import type { IngestionRepository, ProductMarketContext } from "./repository";
import type { IngestionResult } from "./types";

function currentMarketListing(productId: string, listingId: string, storeId: string, observation: NormalizedListingObservation): CurrentMarketListing {
  return { productId, listingId, storeId, priceCents: observation.listing.priceCents, shippingCents: observation.listing.shippingKnown ? observation.listing.shippingCents : null, shippingKnown: observation.listing.shippingKnown, stockStatus: observation.listing.stockStatus, observedAt: observation.observedAt };
}

function withCurrentListing(context: ProductMarketContext, current: CurrentMarketListing): ProductMarketContext {
  return { ...context, currentListings: [...context.currentListings.filter((listing) => listing.listingId !== current.listingId), current] };
}

export async function ingestObservation(repository: IngestionRepository, raw: NormalizedListingObservation, options: { minimumPriceDropBasisPoints?: number } = {}): Promise<IngestionResult> {
  const observation = normalizedListingObservationSchema.parse(raw);
  const sourceKey = normalizeSourceKey(observation.source);
  const storeIdentity = { sourceKey, domain: normalizeDomain(observation.store.websiteUrl) };
  let store = await repository.findStore(storeIdentity);
  const storeCreated = !store;
  store ??= await repository.createStore(storeIdentity, observation.store);

  const normalizedProductKey = productIdentity(observation.product);
  let product = await repository.findProduct(normalizedProductKey);
  const productCreated = !product;
  product ??= await repository.createProduct(normalizedProductKey, observation.product);

  const identity = { sourceKey, sourceProductId: observation.sourceProductId ?? null, canonicalUrl: normalizeListingUrl(observation.listing.url) };
  let listing = await repository.findListing(identity, store.id);
  const listingCreated = !listing;
  const oldPrice = listing?.priceCents ?? null;
  const oldStock = listing?.stockStatus ?? null;
  const priceChanged = listing ? listing.priceCents !== observation.listing.priceCents : false;
  const stockChanged = listing ? listing.stockStatus !== observation.listing.stockStatus : false;
  const meaningfulChange = listingCreated || priceChanged || stockChanged;
  const marketSince = new Date(new Date(observation.observedAt).getTime() - 30 * 86_400_000).toISOString();
  const previousMarket = meaningfulChange ? await repository.getProductMarketContext(product.id, marketSince) : null;

  let historyCreated = false;
  if (!listing) {
    listing = await repository.createListing(identity, product.id, store.id, observation);
    await repository.createPriceHistory(listing.id, observation);
    historyCreated = true;
  } else {
    await repository.updateListing(listing.id, observation);
    if (priceChanged || stockChanged) {
      await repository.createPriceHistory(listing.id, observation);
      historyCreated = true;
    }
  }

  const knownShippingCents = observation.listing.shippingKnown ? observation.listing.shippingCents : null;
  const evaluation = observation.financialAssumptions && knownShippingCents !== null ? calculateOpportunity({ ...observation.financialAssumptions, product_price_cents: observation.listing.priceCents, purchase_shipping_cents: knownShippingCents }) : null;
  const evaluationStatus = !observation.listing.shippingKnown ? "insufficient_cost_data" : evaluation ? "evaluated" : "insufficient_market_data";
  const targetPriceCents = listingCreated ? null : await repository.getActiveListingTargetPrice(listing.id);

  const previousHistory: HistoricalPricePoint[] = (previousMarket?.history ?? []).map((entry) => ({ listingId: entry.listingId, priceCents: entry.priceCents, shippingCents: entry.shippingCents, shippingKnown: entry.shippingKnown, stockStatus: entry.stockStatus, recordedAt: entry.observedAt }));
  const shouldCheckLow = priceChanged && oldPrice !== null && observation.listing.priceCents < oldPrice && knownShippingCents !== null && isPurchasable(observation.listing.stockStatus);
  const lowResult = shouldCheckLow ? detectNewPriceLows({ listingId: listing.id, priceCents: observation.listing.priceCents, shippingCents: knownShippingCents, shippingKnown: true, stockStatus: observation.listing.stockStatus, recordedAt: observation.observedAt }, previousHistory) : null;
  const newPriceLow = lowResult?.new30DayLow && lowResult.previous30DayMinimumCents !== null ? { periodDays: 30 as const, previousMinimumCents: lowResult.previous30DayMinimumCents } : lowResult?.new7DayLow && lowResult.previous7DayMinimumCents !== null ? { periodDays: 7 as const, previousMinimumCents: lowResult.previous7DayMinimumCents } : undefined;

  let candidates = !meaningfulChange ? [] : evaluateAlertCandidates({ productId: product.id, productName: observation.product.name, productType: observation.product.productType, tcg: observation.product.tcg, language: observation.product.language, storeId: store.id, storeName: observation.store.name, listingId: listing.id, listingUrl: observation.listing.url, oldPriceCents: oldPrice, oldStockStatus: oldStock, newPriceCents: observation.listing.priceCents, shippingCents: knownShippingCents, newStockStatus: observation.listing.stockStatus, targetPriceCents: targetPriceCents ?? undefined, minimumPriceDropBasisPoints: options.minimumPriceDropBasisPoints, evaluation: evaluation ?? undefined, isNewListing: listingCreated, newPriceLow });

  if (meaningfulChange && previousMarket) {
    const now = new Date(observation.observedAt);
    const previousReference = calculateMarketReference({ productId: product.id, currentListings: previousMarket.currentListings, history: previousMarket.history, now }).reference;
    const updatedMarket = withCurrentListing(previousMarket, currentMarketListing(product.id, listing.id, store.id, observation));
    const currentReference = calculateMarketReference({ productId: product.id, currentListings: updatedMarket.currentListings, history: updatedMarket.history, now }).reference;
    if (currentReference) await repository.saveMarketReferenceSnapshot(currentReference);
    if (!listingCreated && currentReference) {
      const configuration = await repository.getDealConfiguration();
      const currentDeal = evaluateDeal({ listingId: listing.id, productId: product.id, priceCents: observation.listing.priceCents, shippingCents: knownShippingCents, shippingKnown: observation.listing.shippingKnown, stockStatus: observation.listing.stockStatus }, currentReference, configuration.thresholds);
      const previousCurrent = previousMarket.currentListings.find((entry) => entry.listingId === listing.id);
      const previousClassification = previousReference && previousCurrent ? evaluateDeal({ listingId: listing.id, productId: product.id, priceCents: previousCurrent.priceCents, shippingCents: previousCurrent.shippingCents, shippingKnown: previousCurrent.shippingKnown, stockStatus: previousCurrent.stockStatus }, previousReference, configuration.thresholds).classification : null;
      const dealCandidate = createDealAlertCandidate({ previousClassification, evaluation: currentDeal, preferences: configuration.alerts, observedAt: observation.observedAt, productName: observation.product.name, tcg: observation.product.tcg, language: observation.product.language, storeId: store.id, storeName: observation.store.name, listingUrl: observation.listing.url, stockStatus: observation.listing.stockStatus, shippingCents: knownShippingCents, oldPriceCents: oldPrice });
      if (dealCandidate) candidates = [...candidates.filter((candidate) => candidate.alertType !== "price_drop" && candidate.alertType !== "new_price_low"), dealCandidate];
    }
  }

  return { store: { id: store.id, created: storeCreated }, product: { id: product.id, created: productCreated }, listing: { id: listing.id, created: listingCreated, priceChanged, stockChanged, historyCreated }, evaluationStatus, evaluation, alertCandidates: candidates };
}
