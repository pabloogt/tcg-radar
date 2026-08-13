import { z } from "zod";

export const POKEMILLON_SOURCE_KEY = "pokemillon" as const;
export const POKEMILLON_ORIGIN = "https://www.pokemillon.com" as const;

const nullableMoneySchema = z.union([z.string(), z.number(), z.null()]).optional();

export const pokemillonVariantSchema = z.object({
  id: z.union([z.string(), z.number()]),
  title: z.string(),
  option1: z.string().nullable().optional(),
  option2: z.string().nullable().optional(),
  option3: z.string().nullable().optional(),
  available: z.boolean(),
  price: z.union([z.string(), z.number()]),
  compare_at_price: nullableMoneySchema,
  featured_image: z.object({ src: z.string().optional() }).nullable().optional(),
}).passthrough();

export const pokemillonProductSchema = z.object({
  id: z.union([z.string(), z.number()]),
  title: z.string().trim().min(1),
  handle: z.string().trim().min(1),
  body_html: z.string().nullable().optional(),
  vendor: z.string().nullable().optional(),
  product_type: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
  variants: z.array(pokemillonVariantSchema).min(1),
  images: z.array(z.object({ src: z.string().optional() }).passthrough()).default([]),
  options: z.array(z.object({ name: z.string(), values: z.array(z.string()).default([]) }).passthrough()).default([]),
}).passthrough();

export const pokemillonCollectionPageSchema = z.object({
  products: z.array(z.unknown()),
}).passthrough();

export type PokemillonProduct = z.infer<typeof pokemillonProductSchema>;

export type PokemillonCollection = {
  handle: string;
  tcg: "pokemon" | "one_piece";
  label: string;
};

export type MonitorErrorStage = "fetch" | "parse" | "classification" | "ingestion";

export type MonitorRunError = {
  sourceUrl: string;
  stage: MonitorErrorStage;
  message: string;
};

export type MonitorSkip = {
  sourceUrl: string;
  reason: "irrelevant" | "unsupported_tcg" | "ambiguous_product_type" | "ambiguous_variant" | "malformed_price" | "duplicate";
  title: string;
};

export type PokemillonRunLog = {
  startedAt: string;
  finishedAt: string;
  sourceKey: typeof POKEMILLON_SOURCE_KEY;
  pagesFetched: number;
  productsSeen: number;
  observationsProduced: number;
  observationsSkipped: number;
  errorsCount: number;
  pokemon: number;
  onePiece: number;
  ambiguousProducts: number;
  parsingErrors: number;
};
