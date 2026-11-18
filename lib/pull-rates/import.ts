import { normalizeCardNumber, normalizeExternalId } from "@/lib/cards/normalization";
import { pullRateInputSchema } from "@/lib/validation/pull-rates";
import { normalizePullProbability } from "./analytics";
import type { NormalizedPullRateRecord } from "./providers";
import type { PullRateCategoryGroup } from "./types";

export type PullImportFormat = "csv" | "json";
export type PullImportError = { row: number; message: string };
export type PullImportSummary = { rowsRead: number; matchedSets: number; matchedCards: number; recordsCreated: number; recordsUpdated: number; skipped: number; errors: PullImportError[] };
export type PullImportCard = { id: string; cardNumber: string; variantName: string | null; externalIds: Record<string, string> };
export type PullRateWrite = NormalizedPullRateRecord & { setId: string; cardId: string | null; observationKey: string };

export interface PullRateImportRepository {
  listCards(setId: string): Promise<PullImportCard[]>;
  listObservationKeys(setId: string): Promise<Set<string>>;
  upsertRates(rates: readonly PullRateWrite[]): Promise<void>;
}

function parseCsv(content: string): Record<string, string>[] {
  const rows: string[][] = []; let row: string[] = []; let field = ""; let quoted = false;
  for (let index = 0; index < content.length; index += 1) { const character = content[index]; if (character === '"') { if (quoted && content[index + 1] === '"') { field += '"'; index += 1; } else quoted = !quoted; } else if (character === "," && !quoted) { row.push(field); field = ""; } else if ((character === "\n" || character === "\r") && !quoted) { if (character === "\r" && content[index + 1] === "\n") index += 1; row.push(field); field = ""; if (row.some((value) => value.trim())) rows.push(row); row = []; } else field += character; }
  row.push(field); if (row.some((value) => value.trim())) rows.push(row); if (rows.length < 2) return [];
  const headers = rows[0].map((header) => header.replace(/^\uFEFF/, "").trim().toLocaleLowerCase("en"));
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? ""])));
}

function record(value: unknown): Record<string, unknown> | null { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null; }
export function parsePullImportRows(content: string, format: PullImportFormat): unknown[] {
  if (format === "csv") return parseCsv(content);
  const parsed: unknown = JSON.parse(content); if (Array.isArray(parsed)) return parsed;
  const nested = record(parsed)?.pull_rates; return Array.isArray(nested) ? nested : [];
}

function normalizeText(value: string): string { return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").replace(/[^a-z0-9]+/g, " ").trim(); }
export function normalizePullCategory(category: string, explicit?: PullRateCategoryGroup | null, cardNumber?: string | null): PullRateCategoryGroup {
  if (explicit) return explicit;
  if (cardNumber) return "SPECIFIC_CARD";
  const value = normalizeText(category);
  if (/specific|carta concreta|individual card/.test(value)) return "SPECIFIC_CARD";
  if (/top chase|manga rare|enchanted|god rare/.test(value)) return "TOP_CHASE";
  if (/high rarity|alta rareza|double rare|ultra rare/.test(value)) return "HIGH_RARITY_HIT";
  if (/chase tier|top tier|secret rare|special illustration/.test(value)) return "CHASE_TIER";
  if (/any hit|cualquier hit|meaningful hit|hit significativo/.test(value)) return "ANY_HIT";
  if (/special slot|slot especial/.test(value)) return "SPECIAL_SLOT";
  if (/box hit|hit por caja/.test(value)) return "BOX_HIT";
  return "OTHER";
}

export function resolvePullProbability(input: { oddsNumerator: number | null; oddsDenominator: number | null; probabilityPpm: number | null; probabilityBps: number | null; probabilityPercentPpm: number | null; packsPerHitMilli: number | null }): number | null {
  const candidates = [
    normalizePullProbability({ oddsNumerator: input.oddsNumerator, oddsDenominator: input.oddsDenominator }),
    normalizePullProbability({ probabilityPpm: input.probabilityPpm }),
    normalizePullProbability({ probabilityPpm: input.probabilityBps === null ? null : input.probabilityBps * 100 }),
    normalizePullProbability({ probabilityPpm: input.probabilityPercentPpm }),
    normalizePullProbability({ packsPerHitMilli: input.packsPerHitMilli }),
  ].filter((value): value is number => value !== null);
  if (!candidates.length) return null;
  const minimum = Math.min(...candidates); const maximum = Math.max(...candidates); const tolerance = Math.max(2, Math.round(minimum * 0.005));
  return maximum - minimum <= tolerance ? candidates[0] : null;
}

function raw(row: unknown) {
  const value = record(row) ?? {}; let oddsNumerator = value.odds_numerator; let oddsDenominator = value.odds_denominator;
  if (typeof value.odds === "string") { const match = value.odds.match(/^\s*(\d+)\s*(?:\/|in|cada)\s*(\d+)\s*$/i); if (match) { oddsNumerator = match[1]; oddsDenominator = match[2]; } }
  return { category: value.category, category_group: value.category_group, subcategory: value.subcategory, card_id: value.card_id, card_number: value.card_number, variant_name: value.variant_name ?? value.variant, odds_numerator: oddsNumerator, odds_denominator: oddsDenominator, probability_ppm: value.probability_ppm, probability_bps: value.probability_bps, probability: value.probability, packs_per_hit: value.packs_per_hit, sample_size: value.sample_size, source: value.source, source_type: value.source_type ?? "manual", confidence: typeof value.confidence === "string" ? value.confidence.toUpperCase() : value.confidence, source_note: value.source_note, outcome_group: value.outcome_group, mutually_exclusive: value.mutually_exclusive, observed_at: value.observed_at };
}

export function normalizePullRateRows(rows: readonly unknown[]): { records: NormalizedPullRateRecord[]; errors: PullImportError[] } {
  const records: NormalizedPullRateRecord[] = []; const errors: PullImportError[] = [];
  rows.forEach((row, index) => {
    const parsed = pullRateInputSchema.safeParse(raw(row)); if (!parsed.success) { errors.push({ row: index + 1, message: parsed.error.issues[0]?.message ?? "Fila no válida." }); return; }
    const data = parsed.data; const probabilityPpm = resolvePullProbability({ oddsNumerator: data.odds_numerator, oddsDenominator: data.odds_denominator, probabilityPpm: data.probability_ppm, probabilityBps: data.probability_bps, probabilityPercentPpm: data.probability, packsPerHitMilli: data.packs_per_hit });
    if (probabilityPpm === null) { errors.push({ row: index + 1, message: "No se pudo normalizar la probabilidad." }); return; }
    records.push({ externalCardId: null, cardNumber: data.card_number, variantName: data.variant_name, category: data.category, categoryGroup: normalizePullCategory(data.category, data.category_group, data.card_number), subcategory: data.subcategory, oddsNumerator: data.odds_numerator, oddsDenominator: data.odds_denominator, probabilityPpm, sampleSize: data.sample_size, source: data.source, sourceType: data.source_type, reportedConfidence: data.confidence, sourceNote: data.source_note, outcomeGroup: data.outcome_group, mutuallyExclusive: data.mutually_exclusive, observedAt: data.observed_at, sourceMetadata: {} });
  });
  return { records, errors };
}

function cardMatches(cards: readonly PullImportCard[], record: NormalizedPullRateRecord): PullImportCard[] {
  if (!record.cardNumber) return [];
  return cards.filter((card) => normalizeCardNumber(card.cardNumber) === normalizeCardNumber(record.cardNumber!) && (!record.variantName || normalizeExternalId(card.variantName ?? "standard") === normalizeExternalId(record.variantName)));
}

export function pullObservationKey(record: NormalizedPullRateRecord, cardId: string | null): string {
  return [record.categoryGroup, normalizeText(record.category), normalizeText(record.subcategory ?? ""), cardId ?? "tier", record.observedAt ?? "current"].join("|");
}

export async function runPullRateImport(input: { content: string; format: PullImportFormat; setId: string; dryRun: boolean; repository: PullRateImportRepository }): Promise<PullImportSummary> {
  let rows: unknown[]; try { rows = parsePullImportRows(input.content, input.format); } catch { return { rowsRead: 0, matchedSets: 0, matchedCards: 0, recordsCreated: 0, recordsUpdated: 0, skipped: 1, errors: [{ row: 0, message: "El archivo no contiene JSON válido." }] }; }
  const normalized = normalizePullRateRows(rows); const [cards, existing] = await Promise.all([input.repository.listCards(input.setId), input.repository.listObservationKeys(input.setId)]); const errors = [...normalized.errors]; const writes = new Map<string, PullRateWrite>(); let matchedCards = 0;
  normalized.records.forEach((entry, index) => { const matches = cardMatches(cards, entry); if (entry.cardNumber && matches.length !== 1) { errors.push({ row: index + 1, message: matches.length ? "La carta es ambigua; indica la variante." : "No se encontró la carta indicada." }); return; } const cardId = matches[0]?.id ?? null; if (cardId) matchedCards += 1; const observationKey = pullObservationKey(entry, cardId); const identity = `${entry.source}|${observationKey}`; writes.set(identity, { ...entry, setId: input.setId, cardId, observationKey }); });
  const recordsUpdated = [...writes.keys()].filter((key) => existing.has(key)).length; const recordsCreated = writes.size - recordsUpdated;
  if (!input.dryRun && writes.size) await input.repository.upsertRates([...writes.values()]);
  return { rowsRead: rows.length, matchedSets: normalized.records.length ? 1 : 0, matchedCards, recordsCreated, recordsUpdated, skipped: Math.max(0, rows.length - writes.size), errors };
}
