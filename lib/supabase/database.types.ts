export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type ProductRow = {
  created_at: string; demand_score: number | null; id: string; image_url: string | null;
  language: string; long_term_score: number | null; name: string; product_type: string;
  reprint_risk: string; release_date: string | null; retail_price_cents: number | null;
  normalized_key: string | null; set_name: string | null; tcg: string; updated_at: string; user_id: string;
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
  recorded_at: string; stock_status: string; updated_at: string; user_id: string;
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
      products: TableDefinition<ProductRow, Omit<ProductRow, "created_at" | "id" | "normalized_key" | "updated_at"> & { created_at?: string; id?: string; normalized_key?: string | null; reprint_risk?: string; updated_at?: string }>;
      stores: TableDefinition<StoreRow, Omit<StoreRow, "active" | "created_at" | "id" | "normalized_domain" | "source_key" | "updated_at"> & { active?: boolean; created_at?: string; id?: string; normalized_domain?: string | null; source_key?: string | null; updated_at?: string }>;
      listings: TableDefinition<ListingRow, Omit<ListingRow, "canonical_url" | "checked_at" | "created_at" | "id" | "shipping_cents" | "shipping_known" | "source_key" | "source_product_id" | "stock_status" | "updated_at"> & { canonical_url?: string | null; checked_at?: string; created_at?: string; id?: string; shipping_cents?: number; shipping_known?: boolean; source_key?: string | null; source_product_id?: string | null; stock_status?: string; updated_at?: string }>;
      price_history: TableDefinition<PriceHistoryRow, Omit<PriceHistoryRow, "created_at" | "id" | "recorded_at" | "updated_at"> & { created_at?: string; id?: string; recorded_at?: string; updated_at?: string }>;
      purchases: TableDefinition<PurchaseRow, Omit<PurchaseRow, "created_at" | "id" | "shipping_cents" | "updated_at"> & { created_at?: string; id?: string; shipping_cents?: number; updated_at?: string }>;
      sales: TableDefinition<SaleRow, Omit<SaleRow, "created_at" | "id" | "packaging_cents" | "platform_fee_cents" | "shipping_cents" | "updated_at"> & { created_at?: string; id?: string; packaging_cents?: number; platform_fee_cents?: number; shipping_cents?: number; updated_at?: string }>;
      alerts: TableDefinition<AlertRow, Omit<AlertRow, "created_at" | "dedupe_key" | "delivered" | "delivery_attempts" | "delivery_status" | "id" | "last_attempt_at" | "updated_at"> & { created_at?: string; dedupe_key?: string | null; delivered?: boolean; delivery_attempts?: number; delivery_status?: string; id?: string; last_attempt_at?: string | null; updated_at?: string }>;
      listing_alert_targets: TableDefinition<ListingAlertTargetRow, Omit<ListingAlertTargetRow, "created_at" | "enabled" | "id" | "updated_at"> & { created_at?: string; enabled?: boolean; id?: string; updated_at?: string }>;
      monitor_runs: TableDefinition<MonitorRunRow, Omit<MonitorRunRow, "alert_candidates" | "alerts_failed" | "alerts_sent" | "alerts_suppressed" | "created_at" | "errors_count" | "finished_at" | "id" | "listings_created" | "listings_updated" | "observations" | "price_histories_created" | "products_created" | "products_matched" | "products_seen" | "safe_error_summary" | "started_at" | "updated_at"> & { alert_candidates?: number; alerts_failed?: number; alerts_sent?: number; alerts_suppressed?: number; created_at?: string; errors_count?: number; finished_at?: string | null; id?: string; listings_created?: number; listings_updated?: number; observations?: number; price_histories_created?: number; products_created?: number; products_matched?: number; products_seen?: number; safe_error_summary?: string | null; started_at?: string; updated_at?: string }>;
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
