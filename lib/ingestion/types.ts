import type { OpportunityResult } from "@/lib/finance/opportunity";
import type { AlertCandidate } from "@/lib/alerts/evaluate-alerts";
export type StoredStore = { id: string; name: string };
export type StoredProduct = { id: string; name: string };
export type StoredListing = { id: string; productId: string; storeId: string; priceCents: number; shippingCents: number; shippingKnown: boolean; stockStatus: string };
export type IngestionResult = { store: { id: string; created: boolean }; product: { id: string; created: boolean }; listing: { id: string; created: boolean; priceChanged: boolean; stockChanged: boolean; historyCreated: boolean }; evaluationStatus: "evaluated" | "insufficient_market_data" | "insufficient_cost_data"; evaluation: OpportunityResult | null; alertCandidates: AlertCandidate[] };
