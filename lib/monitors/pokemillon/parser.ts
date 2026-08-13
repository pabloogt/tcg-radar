import { normalizeIdentityText } from "@/lib/normalization/text";
import { normalizedListingObservationSchema, type NormalizedListingObservation } from "@/lib/monitors/types";
import {
  POKEMILLON_ORIGIN,
  POKEMILLON_SOURCE_KEY,
  pokemillonCollectionPageSchema,
  pokemillonProductSchema,
  type MonitorRunError,
  type MonitorSkip,
  type PokemillonCollection,
  type PokemillonProduct,
} from "./types";

type ProductType = "elite_trainer_box" | "booster_box" | "booster_bundle" | "collection_box" | "tin" | "starter_deck" | "premium_collection" | "other_sealed" | `sealed_case_${number}_${"etb" | "booster_box"}`;
type ProductClassification = { productType: ProductType } | { ambiguousCase: true } | null;

export type ParsedPokemillonPage = {
  observations: NormalizedListingObservation[];
  skipped: MonitorSkip[];
  errors: MonitorRunError[];
  productsSeen: number;
};

function productUrl(handle: string): string {
  return `${POKEMILLON_ORIGIN}/products/${encodeURIComponent(handle)}`;
}

export function parseShopifyMoney(value: string | number): number | null {
  const normalized = String(value).trim().replace(",", ".");
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(normalized);
  if (!match) return null;
  const euros = Number(match[1]);
  const cents = Number((match[2] ?? "").padEnd(2, "0"));
  if (!Number.isSafeInteger(euros) || euros > Math.floor(Number.MAX_SAFE_INTEGER / 100)) return null;
  return euros * 100 + cents;
}

function detectLanguage(value: string): string | null {
  const text = normalizeIdentityText(value);
  const rules: Array<[string, string]> = [
    ["espanol", "es"], ["spanish", "es"], ["ingles", "en"], ["english", "en"],
    ["japones", "ja"], ["japanese", "ja"], ["italiano", "it"], ["italian", "it"],
    ["frances", "fr"], ["french", "fr"], ["aleman", "de"], ["german", "de"],
    ["chino", "zh"], ["chinese", "zh"], ["coreano", "ko"], ["korean", "ko"],
  ];
  return rules.find(([token]) => new RegExp(`(^| )${token}( |$)`).test(text))?.[1] ?? null;
}

function classifySealedCase(title: string): ProductClassification | undefined {
  const unitPattern = "(etbs?|elite trainer boxes?|booster boxes?|booster displays?|displays?|cajas? de sobres)";
  const prefix = new RegExp(`\\b(?:case|carton|caja|cajon)\\s*(?:de\\s*)?(?:x\\s*)?(\\d{1,3})\\s*${unitPattern}\\b`);
  const suffix = new RegExp(`\\b(\\d{1,3})\\s*${unitPattern}\\s*(?:case|carton|cajon)\\b`);
  const match = prefix.exec(title) ?? suffix.exec(title);
  if (match) {
    const quantity = Number(match[1]);
    if (quantity < 2) return { ambiguousCase: true };
    const unit = /etb|elite trainer box/.test(match[2]) ? "etb" : "booster_box";
    return { productType: `sealed_case_${quantity}_${unit}` };
  }
  if (/\b(case|carton|cajon)\b/.test(title)) return { ambiguousCase: true };
  return undefined;
}

function classifyProductType(product: PokemillonProduct): ProductClassification {
  const title = normalizeIdentityText(product.title);
  const metadata = normalizeIdentityText([product.product_type, ...product.tags].filter(Boolean).join(" "));
  const searchable = `${title} ${metadata}`;

  if (/\b(mystery|misterios[ao]|god pack|pokepack)\b/.test(searchable)) return null;
  if (/\b(fundas?|sleeves?|album|carpeta|tapete|playmat|accesorios?|merchandising|grading|graded|psa|cgc)\b/.test(searchable)) return null;
  if (/\b(single|carta suelta|cartas sueltas)\b/.test(searchable)) return null;

  const sealedCase = classifySealedCase(title);
  if (sealedCase !== undefined) return sealedCase;

  if (/\b(elite trainer box|etb|caja elite de entrenador)\b/.test(searchable)) return { productType: "elite_trainer_box" };
  if (/\b(booster bundle|bundle de sobres)\b/.test(searchable)) return { productType: "booster_bundle" };
  if (/\b(booster box|booster display|display de sobres|caja (?:de )?\d{1,2} sobres|caja de sobres)\b/.test(searchable)) return { productType: "booster_box" };
  if (/\b(starter deck|starter set|mazo (?:de )?(?:inicio|iniciacion|starter)|mazo st ?\d{1,2})\b/.test(searchable)) return { productType: "starter_deck" };
  if (/\b(ultra premium|premium collection|premium set|premium sealed|anniversary set|coleccion premium|tournament collection)\b/.test(searchable)) return { productType: "premium_collection" };
  if (/\b(collection box|collection set|caja coleccion|caja de coleccion|coleccion .*\b(?:ex|gx|v|max))\b/.test(searchable)) return { productType: "collection_box" };
  if (/\b(tin|lata)\b/.test(searchable)) return { productType: "tin" };
  if (/\b(double pack|gift collection|special collection)\b/.test(searchable)) return { productType: "other_sealed" };
  return null;
}

function detectTcg(product: PokemillonProduct, collection: PokemillonCollection): "pokemon" | "one_piece" | null {
  const metadata = normalizeIdentityText([product.title, product.product_type, product.vendor, ...product.tags].filter(Boolean).join(" "));
  if (/\b(magic|mtg|lorcana|sports?|futbol|basket)\b/.test(metadata)) return null;
  const pokemon = /\bpokemon\b/.test(metadata);
  const onePiece = /\bone piece\b/.test(metadata);
  if (pokemon && onePiece) return null;
  if (pokemon) return "pokemon";
  if (onePiece) return "one_piece";
  return collection.tcg;
}

function inferSetName(product: PokemillonProduct, tcg: PokemillonCollection["tcg"]): string | null {
  if (tcg === "one_piece") {
    const code = /\b(OP|EB|PRB)[\s-]?(\d{2})\b/i.exec(product.title);
    return code ? `${code[1].toUpperCase()}-${code[2]}` : null;
  }
  const separator = product.title.split(/\s+[|–—]\s+/).map((part) => part.trim()).filter(Boolean);
  return separator.length > 1 && separator[1].length <= 100 ? separator[1] : null;
}

function isPreorder(product: PokemillonProduct): boolean {
  const text = normalizeIdentityText([product.title, product.body_html, ...product.tags].filter(Boolean).join(" "));
  return /\b(preventa|pre order|preorder|reserva)\b/.test(text);
}

function variantLanguages(product: PokemillonProduct): string[] | null {
  const productLanguage = detectLanguage([product.title, product.body_html, ...product.tags].filter(Boolean).join(" "));
  if (product.variants.length === 1) {
    const variant = product.variants[0];
    return [detectLanguage([variant.title, variant.option1].filter(Boolean).join(" ")) ?? productLanguage ?? "unknown"];
  }

  const optionNames = product.options.map((option) => normalizeIdentityText(option.name));
  const hasOnlyLanguageVariants = optionNames.length === 1 && /\b(idioma|language)\b/.test(optionNames[0]);
  if (!hasOnlyLanguageVariants) return null;

  const languages = product.variants.map((variant) => detectLanguage([variant.title, variant.option1].filter(Boolean).join(" ")));
  if (languages.some((language) => language === null)) return null;
  const known = languages as string[];
  return new Set(known).size === known.length ? known : null;
}

function absoluteImageUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value, POKEMILLON_ORIGIN).toString();
  } catch {
    return null;
  }
}

function parseProduct(product: PokemillonProduct, collection: PokemillonCollection, observedAt: string): { observations: NormalizedListingObservation[]; skip?: MonitorSkip } {
  const url = productUrl(product.handle);
  const tcg = detectTcg(product, collection);
  if (!tcg) return { observations: [], skip: { sourceUrl: url, reason: "unsupported_tcg", title: product.title } };

  const classification = classifyProductType(product);
  if (!classification) return { observations: [], skip: { sourceUrl: url, reason: "irrelevant", title: product.title } };
  if ("ambiguousCase" in classification) return { observations: [], skip: { sourceUrl: url, reason: "ambiguous_product_type", title: product.title } };
  const { productType } = classification;

  const languages = variantLanguages(product);
  if (!languages) return { observations: [], skip: { sourceUrl: url, reason: "ambiguous_variant", title: product.title } };
  const preorder = isPreorder(product);
  const imageFallback = product.images.map((image) => absoluteImageUrl(image.src)).find(Boolean) ?? null;
  const observations: NormalizedListingObservation[] = [];

  for (const [index, variant] of product.variants.entries()) {
    const priceCents = parseShopifyMoney(variant.price);
    if (priceCents === null) return { observations: [], skip: { sourceUrl: url, reason: "malformed_price", title: product.title } };
    const parsedCompareAt = variant.compare_at_price === null || variant.compare_at_price === undefined ? null : parseShopifyMoney(variant.compare_at_price);
    if (variant.compare_at_price !== null && variant.compare_at_price !== undefined && parsedCompareAt === null) {
      return { observations: [], skip: { sourceUrl: url, reason: "malformed_price", title: product.title } };
    }
    const compareAt = parsedCompareAt !== null && parsedCompareAt > priceCents ? parsedCompareAt : null;
    const variantUrl = `${url}?variant=${encodeURIComponent(String(variant.id))}`;
    observations.push(normalizedListingObservationSchema.parse({
      source: POKEMILLON_SOURCE_KEY,
      sourceProductId: String(variant.id),
      store: { name: "Pokemillon", websiteUrl: POKEMILLON_ORIGIN, country: "ES" },
      product: {
        tcg,
        name: product.title,
        setName: inferSetName(product, tcg),
        productType,
        language: languages[index],
        imageUrl: absoluteImageUrl(variant.featured_image?.src) ?? imageFallback,
      },
      listing: {
        url: variantUrl,
        priceCents,
        compareAtPriceCents: compareAt,
        shippingCents: null,
        shippingKnown: false,
        stockStatus: preorder ? "preorder" : variant.available ? "in_stock" : "out_of_stock",
        availableQuantity: null,
        seller: "Pokemillon",
        country: "ES",
      },
      observedAt,
    }));
  }
  return { observations };
}

export function parsePokemillonCollectionPage(rawPage: unknown, collection: PokemillonCollection, observedAt: string): ParsedPokemillonPage {
  const pageUrl = `${POKEMILLON_ORIGIN}/collections/${collection.handle}/products.json`;
  const pageResult = pokemillonCollectionPageSchema.safeParse(rawPage);
  if (!pageResult.success) {
    return { observations: [], skipped: [], errors: [{ sourceUrl: pageUrl, stage: "parse", message: "La respuesta de la colección no tiene el formato esperado." }], productsSeen: 0 };
  }

  const observations: NormalizedListingObservation[] = [];
  const skipped: MonitorSkip[] = [];
  const errors: MonitorRunError[] = [];
  for (const rawProduct of pageResult.data.products) {
    const productResult = pokemillonProductSchema.safeParse(rawProduct);
    if (!productResult.success) {
      errors.push({ sourceUrl: pageUrl, stage: "parse", message: "Un producto no tiene el formato público esperado y fue omitido." });
      continue;
    }
    try {
      const parsed = parseProduct(productResult.data, collection, observedAt);
      observations.push(...parsed.observations);
      if (parsed.skip) skipped.push(parsed.skip);
    } catch {
      errors.push({ sourceUrl: productUrl(productResult.data.handle), stage: "classification", message: "No se pudo normalizar el producto y fue omitido." });
    }
  }
  return { observations, skipped, errors, productsSeen: pageResult.data.products.length };
}
