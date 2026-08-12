import { z } from "zod";

const uuidSchema = z.uuid();
const centsSchema = z.int().min(0).max(2_147_483_647);
const positiveQuantitySchema = z.int().positive().max(2_147_483_647);
const countrySchema = z.string().regex(/^[A-Z]{2}$/, "Use a two-letter ISO country code");
const dateSchema = z.iso.date();
const timestampSchema = z.iso.datetime({ offset: true });
const optionalText = (maximum: number) => z.string().trim().min(1).max(maximum).nullable();

export const tcgSchema = z.enum(["pokemon", "one_piece", "lorcana"]);
export const reprintRiskSchema = z.enum(["low", "medium", "high", "unknown"]);
export const stockStatusSchema = z.enum(["in_stock", "out_of_stock", "preorder", "unknown"]);
export const alertTypeSchema = z.enum(["price_drop", "back_in_stock", "target_price", "manual"]);

export const productSchema = z.object({
  user_id: uuidSchema,
  tcg: tcgSchema,
  name: z.string().trim().min(1).max(200),
  set_name: optionalText(200),
  product_type: z.string().trim().min(1).max(100),
  language: z.string().trim().min(2).max(50),
  release_date: dateSchema.nullable(),
  retail_price_cents: centsSchema.nullable(),
  image_url: z.url().max(2048).nullable(),
  reprint_risk: reprintRiskSchema.default("unknown"),
  demand_score: z.int().min(0).max(100).nullable(),
  long_term_score: z.int().min(0).max(100).nullable(),
});

export const storeSchema = z.object({
  user_id: uuidSchema,
  name: z.string().trim().min(1).max(200),
  website_url: z.url().max(2048).nullable(),
  country: countrySchema,
  shipping_notes: z.string().nullable(),
  active: z.boolean().default(true),
});

export const listingSchema = z.object({
  user_id: uuidSchema,
  product_id: uuidSchema,
  store_id: uuidSchema,
  url: z.url().max(2048),
  price_cents: centsSchema,
  shipping_cents: centsSchema.default(0),
  stock_status: stockStatusSchema.default("unknown"),
  available_quantity: z.int().min(0).max(2_147_483_647).nullable(),
  seller: optionalText(200),
  country: countrySchema,
  checked_at: timestampSchema,
});

export const priceHistorySchema = z.object({
  user_id: uuidSchema,
  listing_id: uuidSchema,
  price_cents: centsSchema,
  stock_status: stockStatusSchema,
  recorded_at: timestampSchema,
});

export const purchaseSchema = z.object({
  user_id: uuidSchema,
  product_id: uuidSchema,
  quantity: positiveQuantitySchema,
  unit_cost_cents: centsSchema,
  shipping_cents: centsSchema.default(0),
  purchase_date: dateSchema,
  source: optionalText(200),
  notes: z.string().nullable(),
});

export const saleSchema = z.object({
  user_id: uuidSchema,
  purchase_id: uuidSchema,
  quantity: positiveQuantitySchema,
  sale_price_cents: centsSchema,
  platform_fee_cents: centsSchema.default(0),
  shipping_cents: centsSchema.default(0),
  packaging_cents: centsSchema.default(0),
  sale_date: dateSchema,
  platform: optionalText(100),
});

export const alertSchema = z.object({
  user_id: uuidSchema,
  listing_id: uuidSchema,
  alert_type: alertTypeSchema,
  price_cents: centsSchema.nullable(),
  delivered: z.boolean().default(false),
  delivered_at: timestampSchema.nullable(),
  error_message: z.string().nullable(),
}).refine(
  ({ delivered, delivered_at }) => delivered === (delivered_at !== null),
  { message: "Delivered alerts require delivered_at", path: ["delivered_at"] },
);

export type ProductInput = z.infer<typeof productSchema>;
export type StoreInput = z.infer<typeof storeSchema>;
export type ListingInput = z.infer<typeof listingSchema>;
export type PriceHistoryInput = z.infer<typeof priceHistorySchema>;
export type PurchaseInput = z.infer<typeof purchaseSchema>;
export type SaleInput = z.infer<typeof saleSchema>;
export type AlertInput = z.infer<typeof alertSchema>;
