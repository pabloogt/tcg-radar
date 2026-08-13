import { normalizeIdentityText } from "./text";
import { normalizeListingUrl } from "./url";
import type { NormalizedListingObservation } from "@/lib/monitors/types";
export function normalizeSourceKey(value: string): string { return normalizeIdentityText(value).replace(/ /g, "_"); }
export function productIdentity(product: NormalizedListingObservation["product"]): string { return [product.tcg, product.setName, product.name, product.productType, product.language].map(normalizeIdentityText).join("|"); }
export function listingIdentity(observation: NormalizedListingObservation): string { const source = normalizeSourceKey(observation.source); return observation.sourceProductId ? `${source}|source:${normalizeIdentityText(observation.sourceProductId)}` : `${source}|url:${normalizeListingUrl(observation.listing.url)}`; }
