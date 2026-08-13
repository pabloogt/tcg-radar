import { z } from "zod";

import { reprintRiskSchema, stockStatusSchema, tcgSchema } from "@/lib/validation/entities";

const emptyToNull = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? null : value;

const nullableText = (maximum: number) =>
  z.preprocess(emptyToNull, z.string().trim().min(1).max(maximum).nullable());

const nullableUrl = z.preprocess(
  emptyToNull,
  z.url("Introduce una URL válida").max(2048).nullable(),
);

const optionalProductImageUrl = z.preprocess(
  (value) => {
    if (value === undefined || value === null) return null;
    if (typeof value === "string" && value.trim() === "") return null;
    return typeof value === "string" ? value.trim() : value;
  },
  z.url("Introduce una URL válida").max(2048).nullable(),
);

const nullableDate = z.preprocess(emptyToNull, z.iso.date("Introduce una fecha válida").nullable());

const nullableScore = z.preprocess(
  emptyToNull,
  z.coerce.number().int("Debe ser un número entero").min(0).max(100).nullable(),
);

const euroCents = z.preprocess((value) => {
  if (typeof value !== "string" || value.trim() === "") return null;
  const normalized = value.trim().replace(",", ".");
  const euros = Number(normalized);
  return Number.isFinite(euros) ? Math.round(euros * 100) : value;
}, z.number().int().min(0, "El precio no puede ser negativo").max(2_147_483_647).nullable());

export const productFormSchema = z.object({
  tcg: tcgSchema,
  name: z.string().trim().min(1, "El nombre es obligatorio").max(200),
  set_name: nullableText(200),
  product_type: z.string().trim().min(1, "El tipo de producto es obligatorio").max(100),
  language: z.string().trim().min(2, "El idioma es obligatorio").max(50),
  release_date: nullableDate,
  retail_price_cents: euroCents,
  image_url: optionalProductImageUrl,
  reprint_risk: reprintRiskSchema,
  demand_score: nullableScore,
  long_term_score: nullableScore,
});

export const storeFormSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(200),
  website_url: nullableUrl,
  country: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "Usa un código ISO de dos letras"),
  shipping_notes: z.preprocess(emptyToNull, z.string().trim().nullable()),
  active: z.preprocess((value) => value === "on" || value === true, z.boolean()),
});

export const listingFormSchema = z.object({
  product_id: z.uuid("Selecciona un producto válido"),
  store_id: z.uuid("Selecciona una tienda válida"),
  url: z.url("Introduce una URL válida").max(2048),
  price_cents: euroCents.refine((value) => value !== null, "El precio es obligatorio"),
  shipping_cents: z.preprocess((value) => {
    if (typeof value !== "string" || value.trim() === "") return null;
    const euros = Number(value.trim().replace(",", "."));
    return Number.isFinite(euros) ? Math.round(euros * 100) : value;
  }, z.number({ message: "El envío es obligatorio; usa 0 si es gratuito" }).int().min(0, "El envío no puede ser negativo").max(2_147_483_647)),
  stock_status: stockStatusSchema,
  available_quantity: z.preprocess(
    emptyToNull,
    z.coerce.number().int("Debe ser un número entero").min(0).max(2_147_483_647).nullable(),
  ),
  seller: nullableText(200),
  country: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "Usa un código ISO de dos letras"),
});

export type ProductFormData = z.infer<typeof productFormSchema>;
export type StoreFormData = z.infer<typeof storeFormSchema>;
export type ListingFormData = z.infer<typeof listingFormSchema>;
