"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import { databaseErrorState, type ActionState, validationState } from "@/lib/crud/action-state";
import { loadProductInvestmentAnalyses } from "@/lib/investment/product-data";
import { persistProductInvestmentSnapshot } from "@/lib/investment/product-snapshots";
import { persistEffectiveSetSnapshot } from "@/lib/investment/set-snapshots";
import { normalizePullCategory, pullObservationKey, resolvePullProbability, runPullRateImport, type PullImportSummary } from "@/lib/pull-rates/import";
import type { NormalizedPullRateRecord } from "@/lib/pull-rates/providers";
import { SupabasePullRateRepository } from "@/lib/pull-rates/supabase-repository";
import { pullRateInputSchema } from "@/lib/validation/pull-rates";

export type PullImportActionState = { error: string | null; summary: PullImportSummary | null; mode: "preview" | "import" | null };

const importRequestSchema = z.object({ setId: z.uuid(), format: z.enum(["csv", "json"]), mode: z.enum(["preview", "import"]) });

async function refreshInvestmentData(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"], userId: string, setId: string) {
  await persistEffectiveSetSnapshot(supabase, userId, setId);
  const analyses = await loadProductInvestmentAnalyses(supabase, userId, { setIds: [setId], limit: 250 });
  for (const analysis of analyses) await persistProductInvestmentSnapshot(supabase, userId, analysis);
  revalidatePath(`/investment/sets/${setId}`); revalidatePath("/investment"); revalidatePath("/investment/pull-rates"); revalidatePath("/dashboard");
}

export async function importPullRateData(_state: PullImportActionState, formData: FormData): Promise<PullImportActionState> {
  const request = importRequestSchema.safeParse({ setId: formData.get("set_id"), format: formData.get("format"), mode: formData.get("mode") });
  if (!request.success) return { error: "Selecciona colección, formato y modo válidos.", summary: null, mode: null };
  const file = formData.get("file"); if (!(file instanceof File) || file.size === 0 || file.size > 5_000_000) return { error: "Selecciona un archivo de hasta 5 MB.", summary: null, mode: request.data.mode };
  const { supabase, user } = await requireUser(); const { data: set } = await supabase.from("tcg_sets").select("id").eq("id", request.data.setId).eq("user_id", user.id).maybeSingle();
  if (!set) return { error: "La colección no existe o no te pertenece.", summary: null, mode: request.data.mode };
  try {
    const dryRun = request.data.mode === "preview"; const summary = await runPullRateImport({ content: await file.text(), format: request.data.format, setId: set.id, dryRun, repository: new SupabasePullRateRepository(supabase, user.id) });
    if (!dryRun && (summary.recordsCreated > 0 || summary.recordsUpdated > 0)) await refreshInvestmentData(supabase, user.id, set.id);
    revalidatePath("/investment/data"); return { error: null, summary, mode: request.data.mode };
  } catch { return { error: "No se pudo procesar el archivo. No se han expuesto detalles internos.", summary: null, mode: request.data.mode }; }
}

function formValues(formData: FormData) {
  const observed = formData.get("observed_at"); const date = typeof observed === "string" && observed ? new Date(observed) : null; const observedAt = date && !Number.isNaN(date.getTime()) ? date.toISOString() : observed; const oddsDenominator = formData.get("odds_denominator");
  return { category: formData.get("category"), category_group: formData.get("category_group"), subcategory: formData.get("subcategory"), card_id: formData.get("card_id"), card_number: null, variant_name: null, odds_numerator: oddsDenominator ? formData.get("odds_numerator") : null, odds_denominator: oddsDenominator, probability_ppm: null, probability_bps: null, probability: formData.get("probability"), packs_per_hit: formData.get("packs_per_hit"), sample_size: formData.get("sample_size"), source: formData.get("source"), source_type: formData.get("source_type"), confidence: formData.get("confidence"), source_note: formData.get("source_note"), outcome_group: formData.get("outcome_group"), mutually_exclusive: formData.get("mutually_exclusive"), observed_at: observedAt };
}

export async function savePullRate(_state: ActionState, formData: FormData): Promise<ActionState> {
  const id = z.preprocess((value) => value || null, z.uuid().nullable()).safeParse(formData.get("id")); const setId = z.uuid().safeParse(formData.get("set_id")); const parsed = pullRateInputSchema.safeParse(formValues(formData));
  if (!id.success || !setId.success) return databaseErrorState("Registro no válido."); if (!parsed.success) return validationState(parsed.error);
  const { supabase, user } = await requireUser(); const { data: set } = await supabase.from("tcg_sets").select("id").eq("id", setId.data).eq("user_id", user.id).maybeSingle(); if (!set) return databaseErrorState("La colección no existe o no te pertenece.");
  if (parsed.data.card_id) { const { data: card } = await supabase.from("tcg_cards").select("id").eq("id", parsed.data.card_id).eq("set_id", set.id).eq("user_id", user.id).maybeSingle(); if (!card) return databaseErrorState("La carta no pertenece a esta colección."); }
  const probabilityPpm = resolvePullProbability({ oddsNumerator: parsed.data.odds_numerator, oddsDenominator: parsed.data.odds_denominator, probabilityPpm: parsed.data.probability_ppm, probabilityBps: parsed.data.probability_bps, probabilityPercentPpm: parsed.data.probability, packsPerHitMilli: parsed.data.packs_per_hit });
  if (probabilityPpm === null) return databaseErrorState("No se pudo normalizar la probabilidad.");
  const normalized: NormalizedPullRateRecord = { externalCardId: null, cardNumber: null, variantName: null, category: parsed.data.category, categoryGroup: normalizePullCategory(parsed.data.category, parsed.data.category_group, parsed.data.card_id), subcategory: parsed.data.subcategory, oddsNumerator: parsed.data.odds_numerator, oddsDenominator: parsed.data.odds_denominator, probabilityPpm, sampleSize: parsed.data.sample_size, source: parsed.data.source, sourceType: parsed.data.source_type, reportedConfidence: parsed.data.confidence, sourceNote: parsed.data.source_note, outcomeGroup: parsed.data.outcome_group, mutuallyExclusive: parsed.data.mutually_exclusive, observedAt: parsed.data.observed_at, sourceMetadata: {} };
  const values = { user_id: user.id, set_id: set.id, card_id: parsed.data.card_id, category: normalized.category, category_group: normalized.categoryGroup, subcategory: normalized.subcategory, odds_numerator: normalized.oddsNumerator, odds_denominator: normalized.oddsDenominator, probability_ppm: normalized.probabilityPpm, sample_size: normalized.sampleSize, source: normalized.source, source_type: normalized.sourceType, confidence: normalized.reportedConfidence, source_note: normalized.sourceNote, outcome_group: normalized.outcomeGroup, mutually_exclusive: normalized.mutuallyExclusive, observed_at: normalized.observedAt, observation_key: pullObservationKey(normalized, parsed.data.card_id), source_metadata: {} };
  const response = id.data ? await supabase.from("set_pull_rates").update(values).eq("id", id.data).eq("user_id", user.id).select("id").maybeSingle() : await supabase.from("set_pull_rates").upsert(values, { onConflict: "user_id,set_id,source,observation_key" }).select("id").maybeSingle();
  if (response.error || !response.data) return databaseErrorState("No se pudo guardar el pull rate.");
  try { await refreshInvestmentData(supabase, user.id, set.id); } catch { return databaseErrorState("El pull rate se guardó, pero no se pudo actualizar el snapshot."); }
  revalidatePath("/investment/data"); redirect(`/investment/sets/${set.id}`);
}
