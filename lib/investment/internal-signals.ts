import type { InvestmentMetrics } from "./scoring";
import type { MetricProvenance, SetMetricSignals } from "./provider";
import { deriveSetPriceMomentum, deriveSetScarcity } from "./signals";

export type SignalListing = { id: string; productId: string; storeId: string; stockStatus: string };
export type SignalHistory = { listingId: string; priceCents: number; shippingCents: number | null; shippingKnown: boolean; stockStatus: string; recordedAt: string };

export function deriveInternalSetSignals(input: { productIds: readonly string[]; listings: readonly SignalListing[]; history: readonly SignalHistory[]; now: Date }): SetMetricSignals {
  const productIds = new Set(input.productIds);
  const listings = input.listings.filter((listing) => productIds.has(listing.productId));
  const listingIds = new Set(listings.map((listing) => listing.id));
  const distinctStores = new Set(listings.map((listing) => listing.storeId)).size;
  const storesInStock = new Set(listings.filter((listing) => listing.stockStatus === "in_stock" || listing.stockStatus === "preorder").map((listing) => listing.storeId)).size;
  const scarcity = deriveSetScarcity({ distinctStores, storesInStock });
  const recent: number[] = [];
  const previous: number[] = [];
  for (const entry of input.history) {
    if (!listingIds.has(entry.listingId) || !entry.shippingKnown || entry.shippingCents === null || (entry.stockStatus !== "in_stock" && entry.stockStatus !== "preorder")) continue;
    const age = input.now.getTime() - new Date(entry.recordedAt).getTime();
    if (age < 0 || age > 30 * 86_400_000) continue;
    const total = entry.priceCents + entry.shippingCents;
    if (age <= 7 * 86_400_000) recent.push(total); else previous.push(total);
  }
  const priceMomentum = deriveSetPriceMomentum(recent, previous);
  const metrics: Partial<InvestmentMetrics> = { ...(scarcity === null ? {} : { scarcity }), ...(priceMomentum === null ? {} : { priceMomentum }) };
  const provenance: Partial<Record<keyof InvestmentMetrics, MetricProvenance>> = {};
  if (scarcity !== null) provenance.scarcity = { sourceType: "derived", confidence: distinctStores >= 5 ? "MEDIUM" : "LOW", sourceNote: `${storesInStock} de ${distinctStores} tiendas con disponibilidad.` };
  if (priceMomentum !== null) provenance.priceMomentum = { sourceType: "derived", confidence: recent.length >= 5 && previous.length >= 5 ? "MEDIUM" : "LOW", sourceNote: `Medianas de ${recent.length} observaciones recientes y ${previous.length} anteriores.` };
  return { metrics, provenance };
}
