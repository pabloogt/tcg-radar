"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import { databaseErrorState, type ActionState, validationState } from "@/lib/crud/action-state";
import { investmentMetricKeys } from "@/lib/investment/config";
import { normalizedSetKey, resolveProductSet } from "@/lib/investment/linking";
import { loadProductInvestmentAnalyses } from "@/lib/investment/product-data";
import { persistProductInvestmentSnapshot } from "@/lib/investment/product-snapshots";
import type { InvestmentMetrics } from "@/lib/investment/scoring";
import { persistEffectiveSetSnapshot } from "@/lib/investment/set-snapshots";
import { metricsToColumns } from "@/lib/investment/storage";
import { investmentMetricsFormSchema, setFormSchema } from "@/lib/validation/investment";

function setValues(formData: FormData) { return { tcg: formData.get("tcg"), name: formData.get("name"), release_date: formData.get("release_date"), image_url: formData.get("image_url"), series: formData.get("series"), packs_per_booster_box: formData.get("packs_per_booster_box"), cards_per_pack: formData.get("cards_per_pack") }; }

async function linkExactUnlinkedProducts(set: { id: string; tcg: string; name: string; normalized_key: string }, userId: string, supabase: Awaited<ReturnType<typeof requireUser>>["supabase"]) {
  const { data: products } = await supabase.from("products").select("id,tcg,set_name").eq("user_id", userId).eq("tcg", set.tcg).is("set_id", null);
  const ids = (products ?? []).filter((product) => resolveProductSet({ tcg: product.tcg, setName: product.set_name }, [{ id: set.id, tcg: set.tcg, name: set.name, normalizedKey: set.normalized_key }])).map((product) => product.id);
  if (ids.length) await supabase.from("products").update({ set_id: set.id }).eq("user_id", userId).in("id", ids);
}

export async function createSet(_state: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = setFormSchema.safeParse(setValues(formData)); if (!parsed.success) return validationState(parsed.error);
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase.from("tcg_sets").insert({ ...parsed.data, normalized_key: normalizedSetKey(parsed.data.name), user_id: user.id }).select("id,tcg,name,normalized_key").single();
  if (error?.code === "23505") return databaseErrorState("Ya existe una colección con ese nombre y TCG.");
  if (error) return databaseErrorState("No se pudo crear la colección.");
  await linkExactUnlinkedProducts(data, user.id, supabase); revalidatePath("/investment"); redirect(`/investment/sets/${data.id}`);
}

export async function updateSet(_state: ActionState, formData: FormData): Promise<ActionState> {
  const id = z.uuid().safeParse(formData.get("id")); const parsed = setFormSchema.safeParse(setValues(formData)); if (!id.success) return databaseErrorState("Colección no válida."); if (!parsed.success) return validationState(parsed.error);
  const { supabase, user } = await requireUser(); const { data: current } = await supabase.from("tcg_sets").select("id,tcg").eq("id", id.data).eq("user_id", user.id).maybeSingle(); if (!current) return databaseErrorState("La colección no existe o no te pertenece.");
  if (current.tcg !== parsed.data.tcg) { const { count } = await supabase.from("products").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("set_id", current.id); if ((count ?? 0) > 0) return databaseErrorState("No puedes cambiar el TCG mientras haya productos vinculados."); }
  const { data, error } = await supabase.from("tcg_sets").update({ ...parsed.data, normalized_key: normalizedSetKey(parsed.data.name) }).eq("id", id.data).eq("user_id", user.id).select("id,tcg,name,normalized_key").maybeSingle();
  if (error?.code === "23505") return databaseErrorState("Ya existe una colección con ese nombre y TCG."); if (error || !data) return databaseErrorState("No se pudo actualizar la colección.");
  await linkExactUnlinkedProducts(data, user.id, supabase); revalidatePath("/investment"); redirect(`/investment/sets/${data.id}`);
}

export async function deleteSet(_state: ActionState, formData: FormData): Promise<ActionState> {
  const id = z.uuid().safeParse(formData.get("id")); if (!id.success) return databaseErrorState("Colección no válida."); const { supabase, user } = await requireUser(); const { data, error } = await supabase.from("tcg_sets").delete().eq("id", id.data).eq("user_id", user.id).select("id").maybeSingle(); if (error || !data) return databaseErrorState("No se pudo eliminar la colección."); revalidatePath("/investment"); return { error: null };
}

function metricValues(formData: FormData) {
  return { ...Object.fromEntries(investmentMetricKeys.map((key) => [key, formData.get(key)])), top_card_price_cents: formData.get("top_card_price_euros"), top3_cards_value_cents: formData.get("top3_cards_value_euros"), top5_cards_value_cents: formData.get("top5_cards_value_euros"), top10_cards_value_cents: formData.get("top10_cards_value_euros"), cards_over_20_eur: formData.get("cards_over_20_eur"), cards_over_50_eur: formData.get("cards_over_50_eur"), cards_over_100_eur: formData.get("cards_over_100_eur"), estimated_hit_rate_bps: formData.get("estimated_hit_rate_bps"), estimated_top_hit_rate_bps: formData.get("estimated_top_hit_rate_bps"), stores_in_stock: formData.get("stores_in_stock"), stock_decline_30d_bps: formData.get("stock_decline_30d_bps"), sealed_price_30d_change_bps: formData.get("sealed_price_30d_change_bps"), card_market_30d_change_bps: formData.get("card_market_30d_change_bps"), source_type: formData.get("source_type"), confidence: formData.get("confidence"), source_note: formData.get("source_note") };
}

export async function saveInvestmentMetrics(_state: ActionState, formData: FormData): Promise<ActionState> {
  const setId = z.uuid().safeParse(formData.get("set_id")); const parsed = investmentMetricsFormSchema.safeParse(metricValues(formData)); if (!setId.success) return databaseErrorState("Colección no válida."); if (!parsed.success) return validationState(parsed.error);
  const { supabase, user } = await requireUser(); const { data: set } = await supabase.from("tcg_sets").select("id").eq("id", setId.data).eq("user_id", user.id).maybeSingle(); if (!set) return databaseErrorState("La colección no existe o no te pertenece.");
  const parsedMetrics = parsed.data as typeof parsed.data & InvestmentMetrics;
  const metrics = Object.fromEntries(investmentMetricKeys.map((key) => [key, parsedMetrics[key]])) as InvestmentMetrics;
  const provenance = Object.fromEntries(investmentMetricKeys.flatMap((key) => metrics[key] === null ? [] : [[key, { sourceType: parsed.data.source_type, confidence: parsed.data.confidence.toUpperCase(), sourceNote: parsed.data.source_note }]]));
  const values = { ...metricsToColumns(metrics), top_card_price_cents: parsed.data.top_card_price_cents, top3_cards_value_cents: parsed.data.top3_cards_value_cents, top5_cards_value_cents: parsed.data.top5_cards_value_cents, top10_cards_value_cents: parsed.data.top10_cards_value_cents, cards_over_20_eur: parsed.data.cards_over_20_eur, cards_over_50_eur: parsed.data.cards_over_50_eur, cards_over_100_eur: parsed.data.cards_over_100_eur, estimated_hit_rate_bps: parsed.data.estimated_hit_rate_bps, estimated_top_hit_rate_bps: parsed.data.estimated_top_hit_rate_bps, stores_in_stock: parsed.data.stores_in_stock, stock_decline_30d_bps: parsed.data.stock_decline_30d_bps, sealed_price_30d_change_bps: parsed.data.sealed_price_30d_change_bps, card_market_30d_change_bps: parsed.data.card_market_30d_change_bps, metric_provenance: provenance };
  const { error } = await supabase.from("set_investment_metrics").upsert({ user_id: user.id, set_id: set.id, ...values }, { onConflict: "set_id,user_id" }); if (error) return databaseErrorState("No se pudieron guardar las métricas.");
  try { await persistEffectiveSetSnapshot(supabase, user.id, set.id); } catch { return databaseErrorState("Las métricas se guardaron, pero no se pudo crear el snapshot efectivo."); }
  try { const analyses = await loadProductInvestmentAnalyses(supabase, user.id, { setIds: [set.id], limit: 250 }); for (const analysis of analyses) await persistProductInvestmentSnapshot(supabase, user.id, analysis); } catch { return databaseErrorState("Las métricas se guardaron, pero no se pudieron actualizar los snapshots de producto."); }
  revalidatePath(`/investment/sets/${set.id}`); revalidatePath("/investment"); revalidatePath("/dashboard"); return { error: null };
}

export async function assignProductSet(_state: ActionState, formData: FormData): Promise<ActionState> {
  const productId = z.uuid().safeParse(formData.get("product_id")); const setId = z.uuid().nullable().safeParse(formData.get("set_id") || null); if (!productId.success || !setId.success) return databaseErrorState("Asignación no válida."); const { supabase, user } = await requireUser(); const { data: product } = await supabase.from("products").select("id,tcg").eq("id", productId.data).eq("user_id", user.id).maybeSingle(); if (!product) return databaseErrorState("El producto no existe."); if (setId.data) { const { data: set } = await supabase.from("tcg_sets").select("id,tcg").eq("id", setId.data).eq("user_id", user.id).maybeSingle(); if (!set || set.tcg !== product.tcg) return databaseErrorState("La colección debe pertenecer al mismo TCG."); } const { error } = await supabase.from("products").update({ set_id: setId.data }).eq("id", product.id).eq("user_id", user.id); if (error) return databaseErrorState("No se pudo vincular el producto."); revalidatePath("/investment/unlinked"); revalidatePath(`/investment/sets/${setId.data}`); return { error: null };
}
