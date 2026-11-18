import type { MetricSourceType } from "@/lib/investment/provider";

export type MarketSignalConfidence = "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT";
export type StoredMarketSignalConfidence = Exclude<MarketSignalConfidence, "INSUFFICIENT">;
export type MarketSignalSourceType = "internal" | "manual" | "official" | "external" | "derived";
export type MarketSignalType =
  | "stock_availability" | "stock_decline" | "restock_frequency" | "sellout_speed"
  | "sealed_price_momentum" | "store_coverage" | "demand_score" | "manual_demand"
  | "hype_score" | "manual_hype" | "external_hype" | "reprint_event" | "reprint_risk"
  | "manual_reprint_risk" | "official_reprint_announced" | "official_restock_announced"
  | "large_supply_return" | "new_wave_detected" | "availability_expansion"
  | "availability_contraction" | "distributor_signal" | "set_out_of_print"
  | "production_window_closed" | "unknown_supply_status";
export type ReprintStatus = "LOW_RISK" | "MODERATE_RISK" | "HIGH_RISK" | "CONFIRMED_REPRINT" | "UNKNOWN";
export type HypeMomentum = "RISING" | "STABLE" | "FALLING" | "INSUFFICIENT";

export type MarketSignalObservation = {
  id: string;
  setId: string;
  signalType: MarketSignalType;
  sourceType: MarketSignalSourceType;
  sourceKey: string | null;
  value: number;
  confidence: StoredMarketSignalConfidence;
  observedAt: string;
  sampleSize: number | null;
  note: string | null;
  confirmedReprint: boolean;
  reprintStatus: ReprintStatus | null;
  announcementDate: string | null;
  expectedSupplyDate: string | null;
};

export type StockState = "in_stock" | "out_of_stock" | "preorder" | "unknown";
export type StockObservation = {
  listingId: string;
  productId: string;
  storeId: string;
  stockStatus: StockState;
  observedAt: string;
};
export type RestockEvent = StockObservation & { previousStatus: "out_of_stock" };
export type SelloutEvent = StockObservation & { previousStatus: "in_stock" };
export type StockTransition = StockObservation & { previousStatus: StockState; transitionType: "RESTOCK" | "SELLOUT" | "RELEASE" | "OTHER" };
export type SelloutCycle = {
  listingId: string;
  productId: string;
  storeId: string;
  restockedAt: string;
  soldOutAt: string;
  durationHours: number;
};

export type MarketCoverage = {
  monitoredStores: number;
  storesWithSet: number;
  storesInStock: number;
  activeListings: number;
  productsObserved: number;
  monitorRuns30d: number;
};

export type DemandComponents = {
  selloutSpeed: number | null;
  availabilityContraction: number | null;
  restockActivity: number | null;
  sealedPriceMomentum: number | null;
  inStockPressure: number | null;
};

export type DemandAnalytics = {
  score: number | null;
  derivedScore: number | null;
  manualScore: number | null;
  confidence: MarketSignalConfidence;
  sourceType: MetricSourceType | null;
  components: DemandComponents;
  coverage: MarketCoverage;
  restocks7d: number;
  restocks30d: number;
  restocks90d: number;
  restocksByProduct: { productId: string; restocks7d: number; restocks30d: number; restocks90d: number }[];
  selloutCycles: number;
  medianSelloutHours: number | null;
  fastSelloutShare: number | null;
  selloutConfidence: MarketSignalConfidence;
  availabilityChange7d: number | null;
  availabilityChange30d: number | null;
  historyDays: number;
  reasons: string[];
  warnings: string[];
};

export type HypeAnalytics = {
  score: number | null;
  confidence: MarketSignalConfidence;
  sourceType: MetricSourceType | null;
  sourceCount: number;
  momentum: HypeMomentum;
  latestSignals: MarketSignalObservation[];
  reasons: string[];
  warnings: string[];
};

export type ReprintAnalytics = {
  risk: number | null;
  derivedRisk: number | null;
  manualRisk: number | null;
  safety: number | null;
  confidence: MarketSignalConfidence;
  sourceType: MetricSourceType | null;
  status: ReprintStatus;
  confirmedReprint: boolean;
  possibleSupplyExpansion: boolean;
  availabilityExpansionScore: number | null;
  broadRestockStores: number;
  confirmedSignals: MarketSignalObservation[];
  inferredSignals: MarketSignalObservation[];
  reasons: string[];
  warnings: string[];
};

export type SetMarketIntelligence = {
  setId: string;
  demand: DemandAnalytics;
  hype: HypeAnalytics;
  reprint: ReprintAnalytics;
};
