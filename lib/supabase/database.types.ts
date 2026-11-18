export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type ProductRow = {
  created_at: string; demand_score: number | null; id: string; image_url: string | null;
  language: string; long_term_score: number | null; name: string; product_type: string;
  reprint_risk: string; release_date: string | null; retail_price_cents: number | null;
  normalized_key: string | null; set_id: string | null; set_name: string | null; tcg: string; updated_at: string; user_id: string;
};
type StoreRow = {
  active: boolean; country: string; created_at: string; id: string; name: string;
  normalized_domain: string | null; shipping_notes: string | null; source_key: string | null; updated_at: string; user_id: string; website_url: string | null;
};
type ListingRow = {
  available_quantity: number | null; checked_at: string; country: string; created_at: string;
  id: string; price_cents: number; product_id: string; seller: string | null;
  shipping_cents: number; shipping_known: boolean; stock_status: string; store_id: string; updated_at: string;
  canonical_url: string | null; source_key: string | null; source_product_id: string | null; url: string; user_id: string;
};
type PriceHistoryRow = {
  created_at: string; id: string; listing_id: string; price_cents: number;
  recorded_at: string; shipping_cents: number | null; shipping_known: boolean;
  stock_status: string; updated_at: string; user_id: string;
};
type PurchaseRow = {
  created_at: string; id: string; notes: string | null; product_id: string; purchase_date: string;
  quantity: number; shipping_cents: number; source: string | null; unit_cost_cents: number;
  updated_at: string; user_id: string;
};
type SaleRow = {
  created_at: string; id: string; packaging_cents: number; platform: string | null;
  platform_fee_cents: number; purchase_id: string; quantity: number; sale_date: string;
  sale_price_cents: number; shipping_cents: number; updated_at: string; user_id: string;
};
type AlertRow = {
  alert_type: string; created_at: string; delivered: boolean; delivered_at: string | null;
  error_message: string | null; id: string; listing_id: string; price_cents: number | null;
  dedupe_key: string | null; delivery_status: string; delivery_attempts: number;
  last_attempt_at: string | null; updated_at: string; user_id: string;
};
type ListingAlertTargetRow = {
  created_at: string; enabled: boolean; id: string; listing_id: string;
  target_price_cents: number; updated_at: string; user_id: string;
};
type MonitorRunRow = {
  alert_candidates: number; alerts_failed: number; alerts_sent: number; alerts_suppressed: number;
  created_at: string; errors_count: number; finished_at: string | null; id: string;
  listings_created: number; listings_updated: number; observations: number;
  price_histories_created: number; products_created: number; products_matched: number;
  products_seen: number; safe_error_summary: string | null; source_key: string;
  started_at: string; status: string; trigger_type: string; updated_at: string; user_id: string;
};
type DealSettingsRow = {
  alert_bargains: boolean; alert_good_prices: boolean; alert_opportunities: boolean;
  bargain_bps: number; created_at: string; expensive_bps: number; good_price_bps: number;
  opportunity_bps: number; updated_at: string; user_id: string;
};
type MarketReferenceSnapshotRow = {
  comparison_basis: string; confidence: string; created_at: string; id: string;
  metadata: Json; observed_at: string; product_id: string; reference_price_cents: number;
  source: string; user_id: string;
};
type TcgSetRow = {
  created_at: string; id: string; image_url: string | null; name: string; normalized_key: string;
  release_date: string | null; series: string | null; tcg: string; updated_at: string; user_id: string;
  packs_per_booster_box: number | null; cards_per_pack: number | null;
};
type SetInvestmentMetricsRow = {
  id: string; user_id: string; set_id: string; chase_strength: number | null; chase_depth: number | null;
  card_value: number | null; pull_rate_attractiveness: number | null; character_strength: number | null;
  collector_appeal: number | null; demand: number | null; hype: number | null; scarcity: number | null;
  reprint_safety: number | null; price_momentum: number | null; set_maturity: number | null;
  top_card_price_cents: number | null; top3_cards_value_cents: number | null; top5_cards_value_cents: number | null;
  top10_cards_value_cents: number | null; cards_over_20_eur: number | null; cards_over_50_eur: number | null;
  cards_over_100_eur: number | null; estimated_hit_rate_bps: number | null; estimated_top_hit_rate_bps: number | null;
  stores_in_stock: number | null; stock_decline_30d_bps: number | null; sealed_price_30d_change_bps: number | null;
  card_market_30d_change_bps: number | null; metric_provenance: Json; created_at: string; updated_at: string;
};
type SetInvestmentSnapshotRow = {
  id: string; user_id: string; set_id: string; metrics: Json; short_score: number | null;
  medium_score: number | null; long_score: number | null; data_completeness: number;
  confidence: string; observed_at: string; created_at: string;
};
type ProductInvestmentProfileRow = {
  id: string; user_id: string; product_id: string; vehicle_score_override: number | null;
  exclusive: boolean; limited_distribution: boolean; special_promo_score: number | null;
  storage_efficiency_score: number | null; liquidity_score: number | null;
  sealed_collectability_score: number | null; notes: string | null; created_at: string; updated_at: string;
};
type ProductInvestmentSnapshotRow = {
  id: string; user_id: string; product_id: string; short_score: number | null; medium_score: number | null;
  long_score: number | null; set_short_score: number | null; set_medium_score: number | null;
  set_long_score: number | null; vehicle_score: number; entry_score: number | null;
  entry_confidence: string; entry_completeness: number; best_listing_price_cents: number | null;
  market_reference_cents: number | null; comparison_basis: string | null; calculation_fingerprint: string;
  created_at: string;
};
type InvestmentPortfolioRow = {
  id: string; user_id: string; name: string; budget_cents: number; allocated_cents: number;
  remaining_cents: number; horizon: string; strategy: string; portfolio_score: number | null;
  confidence: string; settings: Json; reasons: Json; warnings: Json; created_at: string;
};
type InvestmentPortfolioPositionRow = {
  id: string; user_id: string; portfolio_id: string; product_id: string | null; set_id: string | null;
  listing_id: string | null; product_name: string; set_name: string; store_name: string; tcg: string;
  language: string; product_type: string; horizon: string; quantity: number; unit_cost_cents: number;
  total_cost_cents: number; product_score: number; set_score: number | null; vehicle_score: number;
  entry_score: number | null; entry_confidence: string; market_reference_cents: number | null;
  deal_classification: string | null; shipping_known: boolean; stock_status: string; country: string;
  product_url: string; created_at: string;
};
type TcgCardRow = {
  id: string; user_id: string; set_id: string; tcg: string; name: string; card_number: string;
  rarity: string; rarity_group: string | null; normalized_key: string; image_url: string | null;
  character_name: string | null; variant_name: string | null; external_ids: Json;
  created_at: string; updated_at: string;
};
type CardPriceHistoryRow = {
  id: string; user_id: string; card_id: string; source: string; currency: string;
  market_price_cents: number | null; low_price_cents: number | null; trend_price_cents: number | null;
  observed_at: string; observation_key: string; source_metadata: Json; created_at: string;
};
type SetPullRateRow = {
  id: string; user_id: string; set_id: string; card_id: string | null; category: string;
  category_group: string; subcategory: string | null; odds_numerator: number | null;
  odds_denominator: number | null; probability_ppm: number; sample_size: number | null;
  source: string; source_type: string; confidence: string | null; source_note: string | null;
  outcome_group: string | null; mutually_exclusive: boolean; observed_at: string | null;
  observation_key: string; source_metadata: Json; created_at: string; updated_at: string;
};
type SetMarketSignalRow = {
  id: string; user_id: string; set_id: string; signal_type: string; source_type: string;
  source_key: string | null; value: number; confidence: string; observed_at: string;
  sample_size: number | null; metadata: Json; note: string | null; reprint_status: string | null;
  confirmed_reprint: boolean; announcement_date: string | null; expected_supply_date: string | null;
  created_at: string; updated_at: string;
};

type TableDefinition<Row, Insert, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: DatabaseRelationship[];
};

type DatabaseRelationship = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

export type Database = {
  public: {
    Tables: {
      products: TableDefinition<ProductRow, Omit<ProductRow, "created_at" | "id" | "normalized_key" | "set_id" | "updated_at"> & { created_at?: string; id?: string; normalized_key?: string | null; set_id?: string | null; reprint_risk?: string; updated_at?: string }>;
      stores: TableDefinition<StoreRow, Omit<StoreRow, "active" | "created_at" | "id" | "normalized_domain" | "source_key" | "updated_at"> & { active?: boolean; created_at?: string; id?: string; normalized_domain?: string | null; source_key?: string | null; updated_at?: string }>;
      listings: TableDefinition<ListingRow, Omit<ListingRow, "canonical_url" | "checked_at" | "created_at" | "id" | "shipping_cents" | "shipping_known" | "source_key" | "source_product_id" | "stock_status" | "updated_at"> & { canonical_url?: string | null; checked_at?: string; created_at?: string; id?: string; shipping_cents?: number; shipping_known?: boolean; source_key?: string | null; source_product_id?: string | null; stock_status?: string; updated_at?: string }>;
      price_history: TableDefinition<PriceHistoryRow, Omit<PriceHistoryRow, "created_at" | "id" | "recorded_at" | "shipping_cents" | "shipping_known" | "updated_at"> & { created_at?: string; id?: string; recorded_at?: string; shipping_cents?: number | null; shipping_known?: boolean; updated_at?: string }>;
      purchases: TableDefinition<PurchaseRow, Omit<PurchaseRow, "created_at" | "id" | "shipping_cents" | "updated_at"> & { created_at?: string; id?: string; shipping_cents?: number; updated_at?: string }>;
      sales: TableDefinition<SaleRow, Omit<SaleRow, "created_at" | "id" | "packaging_cents" | "platform_fee_cents" | "shipping_cents" | "updated_at"> & { created_at?: string; id?: string; packaging_cents?: number; platform_fee_cents?: number; shipping_cents?: number; updated_at?: string }>;
      alerts: TableDefinition<AlertRow, Omit<AlertRow, "created_at" | "dedupe_key" | "delivered" | "delivery_attempts" | "delivery_status" | "id" | "last_attempt_at" | "updated_at"> & { created_at?: string; dedupe_key?: string | null; delivered?: boolean; delivery_attempts?: number; delivery_status?: string; id?: string; last_attempt_at?: string | null; updated_at?: string }>;
      listing_alert_targets: TableDefinition<ListingAlertTargetRow, Omit<ListingAlertTargetRow, "created_at" | "enabled" | "id" | "updated_at"> & { created_at?: string; enabled?: boolean; id?: string; updated_at?: string }>;
      monitor_runs: TableDefinition<MonitorRunRow, Omit<MonitorRunRow, "alert_candidates" | "alerts_failed" | "alerts_sent" | "alerts_suppressed" | "created_at" | "errors_count" | "finished_at" | "id" | "listings_created" | "listings_updated" | "observations" | "price_histories_created" | "products_created" | "products_matched" | "products_seen" | "safe_error_summary" | "started_at" | "updated_at"> & { alert_candidates?: number; alerts_failed?: number; alerts_sent?: number; alerts_suppressed?: number; created_at?: string; errors_count?: number; finished_at?: string | null; id?: string; listings_created?: number; listings_updated?: number; observations?: number; price_histories_created?: number; products_created?: number; products_matched?: number; products_seen?: number; safe_error_summary?: string | null; started_at?: string; updated_at?: string }>;
      deal_settings: TableDefinition<DealSettingsRow, Omit<DealSettingsRow, "alert_bargains" | "alert_good_prices" | "alert_opportunities" | "bargain_bps" | "created_at" | "expensive_bps" | "good_price_bps" | "opportunity_bps" | "updated_at"> & { alert_bargains?: boolean; alert_good_prices?: boolean; alert_opportunities?: boolean; bargain_bps?: number; created_at?: string; expensive_bps?: number; good_price_bps?: number; opportunity_bps?: number; updated_at?: string }>;
      market_reference_snapshots: TableDefinition<MarketReferenceSnapshotRow, Omit<MarketReferenceSnapshotRow, "created_at" | "id" | "metadata"> & { created_at?: string; id?: string; metadata?: Json }>;
      tcg_sets: TableDefinition<TcgSetRow, Omit<TcgSetRow, "cards_per_pack" | "created_at" | "id" | "packs_per_booster_box" | "updated_at"> & { cards_per_pack?: number | null; created_at?: string; id?: string; packs_per_booster_box?: number | null; updated_at?: string }>;
      set_investment_metrics: TableDefinition<SetInvestmentMetricsRow, Omit<SetInvestmentMetricsRow, "created_at" | "id" | "metric_provenance" | "updated_at"> & { created_at?: string; id?: string; metric_provenance?: Json; updated_at?: string }>;
      set_investment_snapshots: TableDefinition<SetInvestmentSnapshotRow, Omit<SetInvestmentSnapshotRow, "created_at" | "id" | "observed_at"> & { created_at?: string; id?: string; observed_at?: string }>;
      product_investment_profiles: TableDefinition<ProductInvestmentProfileRow, Omit<ProductInvestmentProfileRow, "created_at" | "exclusive" | "id" | "limited_distribution" | "updated_at"> & { created_at?: string; exclusive?: boolean; id?: string; limited_distribution?: boolean; updated_at?: string }>;
      product_investment_snapshots: TableDefinition<ProductInvestmentSnapshotRow, Omit<ProductInvestmentSnapshotRow, "created_at" | "id"> & { created_at?: string; id?: string }>;
      investment_portfolios: TableDefinition<InvestmentPortfolioRow, Omit<InvestmentPortfolioRow, "created_at" | "id" | "portfolio_score" | "settings" | "reasons" | "warnings"> & { created_at?: string; id?: string; portfolio_score?: number | null; settings?: Json; reasons?: Json; warnings?: Json }>;
      investment_portfolio_positions: TableDefinition<InvestmentPortfolioPositionRow, Omit<InvestmentPortfolioPositionRow, "created_at" | "id" | "listing_id" | "market_reference_cents" | "product_id" | "set_id"> & { created_at?: string; id?: string; listing_id?: string | null; market_reference_cents?: number | null; product_id?: string | null; set_id?: string | null }>;
      tcg_cards: TableDefinition<TcgCardRow, Omit<TcgCardRow, "created_at" | "external_ids" | "id" | "image_url" | "character_name" | "rarity_group" | "updated_at" | "variant_name"> & { created_at?: string; external_ids?: Json; id?: string; image_url?: string | null; character_name?: string | null; rarity_group?: string | null; updated_at?: string; variant_name?: string | null }>;
      card_price_history: TableDefinition<CardPriceHistoryRow, Omit<CardPriceHistoryRow, "created_at" | "id" | "low_price_cents" | "market_price_cents" | "source_metadata" | "trend_price_cents"> & { created_at?: string; id?: string; low_price_cents?: number | null; market_price_cents?: number | null; source_metadata?: Json; trend_price_cents?: number | null }>;
      set_pull_rates: TableDefinition<SetPullRateRow, Omit<SetPullRateRow, "card_id" | "confidence" | "created_at" | "id" | "mutually_exclusive" | "observed_at" | "odds_denominator" | "odds_numerator" | "outcome_group" | "sample_size" | "source_metadata" | "source_note" | "subcategory" | "updated_at"> & { card_id?: string | null; confidence?: string | null; created_at?: string; id?: string; mutually_exclusive?: boolean; observed_at?: string | null; odds_denominator?: number | null; odds_numerator?: number | null; outcome_group?: string | null; sample_size?: number | null; source_metadata?: Json; source_note?: string | null; subcategory?: string | null; updated_at?: string }>;
      set_market_signals: TableDefinition<SetMarketSignalRow, Omit<SetMarketSignalRow, "announcement_date" | "confirmed_reprint" | "created_at" | "expected_supply_date" | "id" | "metadata" | "note" | "reprint_status" | "sample_size" | "source_key" | "updated_at"> & { announcement_date?: string | null; confirmed_reprint?: boolean; created_at?: string; expected_supply_date?: string | null; id?: string; metadata?: Json; note?: string | null; reprint_status?: string | null; sample_size?: number | null; source_key?: string | null; updated_at?: string }>;
    };
    Views: Record<never, never>;
    Functions: { set_updated_at: { Args: Record<PropertyKey, never>; Returns: unknown } };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};

type PublicSchema = Database["public"];

export type Tables<TableName extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][TableName]["Row"];
export type TablesInsert<TableName extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][TableName]["Insert"];
export type TablesUpdate<TableName extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][TableName]["Update"];
