export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type ProductRow = {
  created_at: string; demand_score: number | null; id: string; image_url: string | null;
  language: string; long_term_score: number | null; name: string; product_type: string;
  reprint_risk: string; release_date: string | null; retail_price_cents: number | null;
  set_name: string | null; tcg: string; updated_at: string; user_id: string;
};
type StoreRow = {
  active: boolean; country: string; created_at: string; id: string; name: string;
  shipping_notes: string | null; updated_at: string; user_id: string; website_url: string | null;
};
type ListingRow = {
  available_quantity: number | null; checked_at: string; country: string; created_at: string;
  id: string; price_cents: number; product_id: string; seller: string | null;
  shipping_cents: number; stock_status: string; store_id: string; updated_at: string;
  url: string; user_id: string;
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
  updated_at: string; user_id: string;
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
      products: TableDefinition<ProductRow, Omit<ProductRow, "created_at" | "id" | "updated_at"> & { created_at?: string; id?: string; reprint_risk?: string; updated_at?: string }>;
      stores: TableDefinition<StoreRow, Omit<StoreRow, "active" | "created_at" | "id" | "updated_at"> & { active?: boolean; created_at?: string; id?: string; updated_at?: string }>;
      listings: TableDefinition<ListingRow, Omit<ListingRow, "checked_at" | "created_at" | "id" | "shipping_cents" | "stock_status" | "updated_at"> & { checked_at?: string; created_at?: string; id?: string; shipping_cents?: number; stock_status?: string; updated_at?: string }>;
      price_history: TableDefinition<PriceHistoryRow, Omit<PriceHistoryRow, "created_at" | "id" | "recorded_at" | "updated_at"> & { created_at?: string; id?: string; recorded_at?: string; updated_at?: string }>;
      purchases: TableDefinition<PurchaseRow, Omit<PurchaseRow, "created_at" | "id" | "shipping_cents" | "updated_at"> & { created_at?: string; id?: string; shipping_cents?: number; updated_at?: string }>;
      sales: TableDefinition<SaleRow, Omit<SaleRow, "created_at" | "id" | "packaging_cents" | "platform_fee_cents" | "shipping_cents" | "updated_at"> & { created_at?: string; id?: string; packaging_cents?: number; platform_fee_cents?: number; shipping_cents?: number; updated_at?: string }>;
      alerts: TableDefinition<AlertRow, Omit<AlertRow, "created_at" | "delivered" | "id" | "updated_at"> & { created_at?: string; delivered?: boolean; id?: string; updated_at?: string }>;
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
