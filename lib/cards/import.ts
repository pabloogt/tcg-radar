import type { NormalizedCardPriceRecord, NormalizedCardRecord } from "./providers";
import { cardIdentity, normalizeCardNumber, normalizeExternalId, normalizedCardKey } from "./normalization";
import { cardImportRowSchema, cardPriceImportRowSchema } from "@/lib/validation/cards";

export type ImportFormat = "csv" | "json";
export type ImportKind = "cards" | "prices";
export type ImportError = { row: number; message: string };
export type CardImportSummary = { rowsRead: number; cardsCreated: number; cardsMatched: number; pricesCreated: number; skipped: number; errors: ImportError[] };
export type ExistingImportCard = { id: string; setId: string; name: string; cardNumber: string; rarity: string; variantName: string | null; externalIds: Record<string, string> };
export type CardWrite = NormalizedCardRecord & { setId: string; tcg: string; normalizedKey: string; externalIds: Record<string, string> };
export type PriceWrite = NormalizedCardPriceRecord & { cardId: string; observationKey: string };

export interface CardImportRepository {
  listCards(setId: string): Promise<ExistingImportCard[]>;
  upsertCards(cards: readonly CardWrite[]): Promise<void>;
  listObservationKeys(cardIds: readonly string[]): Promise<Set<string>>;
  insertPrices(prices: readonly PriceWrite[]): Promise<void>;
}

function parseCsv(content: string): Record<string, string>[] {
  const rows: string[][] = []; let row: string[] = []; let field = ""; let quoted = false;
  for (let index = 0; index < content.length; index += 1) { const character = content[index]; if (character === '"') { if (quoted && content[index + 1] === '"') { field += '"'; index += 1; } else quoted = !quoted; } else if (character === "," && !quoted) { row.push(field); field = ""; } else if ((character === "\n" || character === "\r") && !quoted) { if (character === "\r" && content[index + 1] === "\n") index += 1; row.push(field); field = ""; if (row.some((value) => value.trim())) rows.push(row); row = []; } else field += character; }
  row.push(field); if (row.some((value) => value.trim())) rows.push(row); if (rows.length < 2) return [];
  const headers = rows[0].map((header) => header.replace(/^\uFEFF/, "").trim().toLocaleLowerCase("en"));
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? ""])));
}

function unknownRecord(value: unknown): Record<string, unknown> | null { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null; }
function rowsFromJson(content: string, kind: ImportKind): unknown[] { const parsed: unknown = JSON.parse(content); if (Array.isArray(parsed)) return parsed; const object = unknownRecord(parsed); const nested = object?.[kind]; return Array.isArray(nested) ? nested : []; }
export function parseImportRows(content: string, format: ImportFormat, kind: ImportKind): unknown[] { return format === "csv" ? parseCsv(content) : rowsFromJson(content, kind); }

function cardRaw(row: unknown) { const value = unknownRecord(row) ?? {}; return { name: value.name, card_number: value.card_number, rarity: value.rarity, rarity_group: value.rarity_group, character_name: value.character_name ?? value.character, variant_name: value.variant_name ?? value.variant, image_url: value.image_url, external_id: value.external_id, external_source: value.external_source ?? "import" }; }
function priceRaw(row: unknown) { const value = unknownRecord(row) ?? {}; return { external_id: value.external_id, card_number: value.card_number, variant_name: value.variant_name ?? value.variant, source: value.source, currency: value.currency, market_price: value.market_price ?? value.price, low_price: value.low_price, trend_price: value.trend_price, observed_at: value.observed_at }; }

export function normalizeCardImportRows(rows: readonly unknown[]): { records: CardWrite[]; errors: ImportError[] } {
  const records: CardWrite[] = []; const errors: ImportError[] = [];
  rows.forEach((row, index) => { const parsed = cardImportRowSchema.safeParse(cardRaw(row)); if (!parsed.success) { errors.push({ row: index + 1, message: parsed.error.issues[0]?.message ?? "Fila de carta no válida." }); return; } const data = parsed.data; records.push({ externalId: data.external_id, name: data.name, cardNumber: data.card_number, rarity: data.rarity, rarityGroup: data.rarity_group, imageUrl: data.image_url, characterName: data.character_name, variantName: data.variant_name, setId: "", tcg: "", normalizedKey: normalizedCardKey({ name: data.name, rarity: data.rarity, variantName: data.variant_name }), externalIds: data.external_id ? { [normalizeExternalId(data.external_source)]: data.external_id } : {} }); });
  return { records, errors };
}

export function normalizePriceImportRows(rows: readonly unknown[]): { records: NormalizedCardPriceRecord[]; errors: ImportError[] } {
  const records: NormalizedCardPriceRecord[] = []; const errors: ImportError[] = [];
  rows.forEach((row, index) => { const parsed = cardPriceImportRowSchema.safeParse(priceRaw(row)); if (!parsed.success) { errors.push({ row: index + 1, message: parsed.error.issues[0]?.message ?? "Fila de precio no válida." }); return; } const data = parsed.data; records.push({ externalId: data.external_id, cardNumber: data.card_number, variantName: data.variant_name, source: data.source, currency: data.currency, marketPriceCents: data.market_price, lowPriceCents: data.low_price, trendPriceCents: data.trend_price, observedAt: data.observed_at, sourceMetadata: {} }); });
  return { records, errors };
}

function externalValues(card: ExistingImportCard): string[] { return Object.values(card.externalIds).map(normalizeExternalId); }
function observationKey(record: NormalizedCardPriceRecord): string { return [record.currency, record.observedAt, record.marketPriceCents ?? "null", record.lowPriceCents ?? "null", record.trendPriceCents ?? "null"].join("|"); }

export async function runCardImport(input: { content: string; format: ImportFormat; setId: string; tcg: string; dryRun: boolean; repository: CardImportRepository }): Promise<CardImportSummary> {
  let rows: unknown[]; try { rows = parseImportRows(input.content, input.format, "cards"); } catch { return { rowsRead: 0, cardsCreated: 0, cardsMatched: 0, pricesCreated: 0, skipped: 1, errors: [{ row: 0, message: "El archivo no contiene JSON válido." }] }; }
  const normalized = normalizeCardImportRows(rows); const existing = await input.repository.listCards(input.setId); const existingByIdentity = new Map(existing.map((card) => [cardIdentity({ setId: input.setId, name: card.name, cardNumber: card.cardNumber, rarity: card.rarity, variantName: card.variantName }), card])); const identities = new Set(existingByIdentity.keys());
  const writes = new Map<string, CardWrite>(); let matched = 0;
  for (const record of normalized.records) { const write = { ...record, setId: input.setId, tcg: input.tcg }; const identity = cardIdentity({ setId: input.setId, name: write.name, cardNumber: write.cardNumber, rarity: write.rarity, variantName: write.variantName }); const existingCard = existingByIdentity.get(identity); if (existingCard) matched += 1; const previousWrite = writes.get(identity); writes.set(identity, { ...write, externalIds: { ...existingCard?.externalIds, ...previousWrite?.externalIds, ...write.externalIds } }); }
  const created = [...writes.keys()].filter((identity) => !identities.has(identity)).length;
  if (!input.dryRun && writes.size) await input.repository.upsertCards([...writes.values()]);
  return { rowsRead: rows.length, cardsCreated: created, cardsMatched: matched, pricesCreated: 0, skipped: normalized.errors.length + normalized.records.length - writes.size, errors: normalized.errors };
}

export async function runCardPriceImport(input: { content: string; format: ImportFormat; setId: string; dryRun: boolean; repository: CardImportRepository }): Promise<CardImportSummary> {
  let rows: unknown[]; try { rows = parseImportRows(input.content, input.format, "prices"); } catch { return { rowsRead: 0, cardsCreated: 0, cardsMatched: 0, pricesCreated: 0, skipped: 1, errors: [{ row: 0, message: "El archivo no contiene JSON válido." }] }; }
  const normalized = normalizePriceImportRows(rows); const cards = await input.repository.listCards(input.setId); const existingKeys = await input.repository.listObservationKeys(cards.map((card) => card.id)); const errors = [...normalized.errors]; const writes = new Map<string, PriceWrite>(); let matched = 0;
  normalized.records.forEach((record, index) => { let matches: ExistingImportCard[] = []; if (record.externalId) matches = cards.filter((card) => externalValues(card).includes(normalizeExternalId(record.externalId!))); else if (record.cardNumber) { matches = cards.filter((card) => normalizeCardNumber(card.cardNumber) === normalizeCardNumber(record.cardNumber!) && (!record.variantName || normalizeExternalId(card.variantName ?? "standard") === normalizeExternalId(record.variantName))); } if (matches.length !== 1) { errors.push({ row: index + 1, message: matches.length ? "La carta es ambigua; especifica variante o external_id." : "No se encontró la carta." }); return; } matched += 1; const key = `${matches[0].id}|${record.source}|${observationKey(record)}`; if (!existingKeys.has(key)) writes.set(key, { ...record, cardId: matches[0].id, observationKey: observationKey(record) }); });
  if (!input.dryRun && writes.size) await input.repository.insertPrices([...writes.values()]);
  return { rowsRead: rows.length, cardsCreated: 0, cardsMatched: matched, pricesCreated: writes.size, skipped: errors.length + normalized.records.length - matched + matched - writes.size, errors };
}
