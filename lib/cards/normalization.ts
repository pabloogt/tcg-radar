function normalizeText(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").replace(/[’'`´]/g, "").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

export function normalizeCardNumber(value: string): string {
  return normalizeText(value).replace(/\s+/g, "");
}

export function normalizedCardKey(input: { name: string; rarity: string; variantName?: string | null }): string {
  return [normalizeText(input.rarity), normalizeText(input.variantName ?? "standard")].join("|");
}

export function cardIdentity(input: { setId: string; name: string; cardNumber: string; rarity: string; variantName?: string | null }): string {
  return `${input.setId}|${normalizeCardNumber(input.cardNumber)}|${normalizedCardKey(input)}`;
}

export function normalizeExternalId(value: string): string {
  return normalizeText(value).replace(/\s+/g, "-");
}
