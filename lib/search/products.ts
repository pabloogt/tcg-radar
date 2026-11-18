import { normalizeIdentityText } from "@/lib/normalization/text";

export type SearchableProduct = {
  id: string;
  name: string;
  setName: string | null;
  productType: string;
  tcg: string;
  language: string;
};

export type ProductSearchResult<T extends SearchableProduct> = {
  product: T;
  score: number;
};

function fieldScore(field: string, query: string, exact: number, prefix: number, contains: number): number {
  if (field === query) return exact;
  if (field.startsWith(query)) return prefix;
  if (field.includes(query)) return contains;
  return 0;
}

export function searchProducts<T extends SearchableProduct>(products: readonly T[], rawQuery: string): ProductSearchResult<T>[] {
  const query = normalizeIdentityText(rawQuery);
  if (!query) return [];
  const tokens = query.split(" ");

  return products.flatMap((product) => {
    const name = normalizeIdentityText(product.name);
    const setName = normalizeIdentityText(product.setName);
    const productType = normalizeIdentityText(product.productType);
    const tcg = normalizeIdentityText(product.tcg);
    const language = normalizeIdentityText(product.language);
    const combined = [name, setName, productType, tcg, language].join(" ");
    if (!tokens.every((token) => combined.includes(token))) return [];

    const score = fieldScore(name, query, 1_000, 800, 650)
      + fieldScore(setName, query, 700, 550, 450)
      + fieldScore(productType, query, 300, 240, 180)
      + fieldScore(tcg, query, 180, 140, 100)
      + fieldScore(language, query, 100, 80, 50)
      + tokens.filter((token) => name.includes(token)).length * 40
      + tokens.filter((token) => setName.includes(token)).length * 20;
    return [{ product, score }];
  }).sort((left, right) => right.score - left.score || left.product.name.localeCompare(right.product.name, "es"));
}
