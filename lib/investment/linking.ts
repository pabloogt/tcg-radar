import { normalizeIdentityText } from "@/lib/normalization/text";

export type LinkableSet = { id: string; tcg: string; name: string; normalizedKey: string };
export type LinkableProduct = { tcg: string; setName: string | null };

export function normalizedSetKey(name: string): string {
  return normalizeIdentityText(name).replace(/ /g, "-");
}

export function resolveProductSet(product: LinkableProduct, sets: readonly LinkableSet[]): LinkableSet | null {
  if (!product.setName) return null;
  const key = normalizedSetKey(product.setName);
  const matches = sets.filter((set) => set.tcg === product.tcg && set.normalizedKey === key);
  return matches.length === 1 ? matches[0] : null;
}
