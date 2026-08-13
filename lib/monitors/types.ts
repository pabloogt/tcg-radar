import { z } from "zod";
import { opportunityInputSchema } from "@/lib/finance/opportunity";

export const normalizedListingObservationSchema = z.object({
  source: z.string().trim().min(1).max(100),
  sourceProductId: z.string().trim().min(1).max(500).nullable().optional(),
  store: z.object({ name: z.string().trim().min(1).max(200), websiteUrl: z.url().max(2048), country: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/) }),
  product: z.object({ tcg: z.enum(["pokemon", "one_piece", "lorcana"]), name: z.string().trim().min(1).max(200), setName: z.string().trim().min(1).max(200).nullable().optional(), productType: z.string().trim().min(1).max(100), language: z.string().trim().min(2).max(50), imageUrl: z.url().max(2048).nullable().optional() }),
  listing: z.object({ url: z.url().max(2048), priceCents: z.number().int().min(0), compareAtPriceCents: z.number().int().min(0).nullable().optional(), shippingCents: z.number().int().min(0).nullable(), shippingKnown: z.boolean().default(true), stockStatus: z.enum(["in_stock", "out_of_stock", "preorder", "unknown"]), availableQuantity: z.number().int().min(0).nullable(), seller: z.string().trim().min(1).max(200).nullable(), country: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/) }).superRefine((listing, context) => {
    if (listing.shippingKnown && listing.shippingCents === null) context.addIssue({ code: "custom", path: ["shippingCents"], message: "Known shipping requires an amount." });
    if (!listing.shippingKnown && listing.shippingCents !== null) context.addIssue({ code: "custom", path: ["shippingCents"], message: "Unknown shipping must not contain a monetary amount." });
  }),
  observedAt: z.iso.datetime({ offset: true }),
  financialAssumptions: opportunityInputSchema.omit({ product_price_cents: true, purchase_shipping_cents: true }).optional(),
});
export type NormalizedListingObservation = z.infer<typeof normalizedListingObservationSchema>;
export interface StoreMonitor { readonly sourceKey: string; run(): Promise<NormalizedListingObservation[]>; }
