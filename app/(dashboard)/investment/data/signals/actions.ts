"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import { databaseErrorState, type ActionState, validationState } from "@/lib/crud/action-state";
import { loadProductInvestmentAnalyses } from "@/lib/investment/product-data";
import { persistProductInvestmentSnapshot } from "@/lib/investment/product-snapshots";
import { persistEffectiveSetSnapshot } from "@/lib/investment/set-snapshots";
import { refreshSetMarketSignals, refreshSetMarketSignalsSafely } from "@/lib/market-signals/refresh";
import { marketSignalFormSchema } from "@/lib/validation/market-signals";

function isoDateTime(value: FormDataEntryValue | null): FormDataEntryValue | null {
  if (typeof value !== "string" || !value.trim()) return value;
  const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

function values(formData: FormData) {
  return { set_id: formData.get("set_id"), signal_type: formData.get("signal_type"), source_type: formData.get("source_type"), source_key: formData.get("source_key"), value: formData.get("value"), confidence: formData.get("confidence"), observed_at: isoDateTime(formData.get("observed_at")), sample_size: formData.get("sample_size"), note: formData.get("note"), reprint_status: formData.get("reprint_status"), confirmed_reprint: formData.get("confirmed_reprint") === "true", announcement_date: formData.get("announcement_date"), expected_supply_date: formData.get("expected_supply_date") };
}

async function verifySet(setId: string, userId: string, supabase: Awaited<ReturnType<typeof requireUser>>["supabase"]) {
  const { data } = await supabase.from("tcg_sets").select("id").eq("id", setId).eq("user_id", userId).maybeSingle(); return data;
}

async function updateSnapshots(setId: string, userId: string, supabase: Awaited<ReturnType<typeof requireUser>>["supabase"]) {
  await persistEffectiveSetSnapshot(supabase, userId, setId);
  const analyses = await loadProductInvestmentAnalyses(supabase, userId, { setIds: [setId], limit: 250 });
  for (const analysis of analyses) await persistProductInvestmentSnapshot(supabase, userId, analysis);
}

function revalidate(setId: string) { revalidatePath("/investment/data/signals"); revalidatePath(`/investment/sets/${setId}`); revalidatePath("/investment"); revalidatePath("/dashboard"); }

export async function createMarketSignal(_state: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = marketSignalFormSchema.safeParse(values(formData)); if (!parsed.success) return validationState(parsed.error);
  const { supabase, user } = await requireUser(); if (!await verifySet(parsed.data.set_id, user.id, supabase)) return databaseErrorState("La colección no existe o no te pertenece.");
  const { error } = await supabase.from("set_market_signals").insert({ user_id: user.id, set_id: parsed.data.set_id, signal_type: parsed.data.signal_type, source_type: parsed.data.source_type, source_key: parsed.data.source_key, value: parsed.data.value, confidence: parsed.data.confidence, observed_at: parsed.data.observed_at, sample_size: parsed.data.sample_size, note: parsed.data.note, reprint_status: parsed.data.reprint_status, confirmed_reprint: parsed.data.confirmed_reprint, announcement_date: parsed.data.announcement_date, expected_supply_date: parsed.data.expected_supply_date });
  if (error) return databaseErrorState("No se pudo guardar la señal.");
  await refreshSetMarketSignalsSafely(supabase, user.id, parsed.data.set_id); try { await updateSnapshots(parsed.data.set_id, user.id, supabase); } catch { return databaseErrorState("La señal se guardó, pero no se pudieron actualizar los snapshots."); }
  revalidate(parsed.data.set_id); return { error: null };
}

export async function updateMarketSignal(_state: ActionState, formData: FormData): Promise<ActionState> {
  const id = z.uuid().safeParse(formData.get("id")); const parsed = marketSignalFormSchema.safeParse(values(formData)); if (!id.success) return databaseErrorState("Señal no válida."); if (!parsed.success) return validationState(parsed.error);
  const { supabase, user } = await requireUser();
  const { data: current } = await supabase.from("set_market_signals").select("id,set_id,source_type").eq("id", id.data).eq("user_id", user.id).in("source_type", ["manual", "official"]).maybeSingle();
  if (!current || !await verifySet(parsed.data.set_id, user.id, supabase)) return databaseErrorState("La señal no existe, no es editable o no te pertenece.");
  const { data, error } = await supabase.from("set_market_signals").update({ set_id: parsed.data.set_id, signal_type: parsed.data.signal_type, source_type: parsed.data.source_type, source_key: parsed.data.source_key, value: parsed.data.value, confidence: parsed.data.confidence, observed_at: parsed.data.observed_at, sample_size: parsed.data.sample_size, note: parsed.data.note, reprint_status: parsed.data.reprint_status, confirmed_reprint: parsed.data.confirmed_reprint, announcement_date: parsed.data.announcement_date, expected_supply_date: parsed.data.expected_supply_date }).eq("id", current.id).eq("user_id", user.id).in("source_type", ["manual", "official"]).select("id").maybeSingle();
  if (error || !data) return databaseErrorState("No se pudo actualizar la señal.");
  const affected = new Set([current.set_id, parsed.data.set_id]); for (const setId of affected) { await refreshSetMarketSignalsSafely(supabase, user.id, setId); await updateSnapshots(setId, user.id, supabase); revalidate(setId); }
  redirect("/investment/data/signals");
}

export async function deleteMarketSignal(_state: ActionState, formData: FormData): Promise<ActionState> {
  const id = z.uuid().safeParse(formData.get("id")); if (!id.success) return databaseErrorState("Señal no válida."); const { supabase, user } = await requireUser();
  const { data: current } = await supabase.from("set_market_signals").select("id,set_id").eq("id", id.data).eq("user_id", user.id).in("source_type", ["manual", "official"]).maybeSingle(); if (!current) return databaseErrorState("La señal no existe, no es editable o no te pertenece.");
  const { data, error } = await supabase.from("set_market_signals").delete().eq("id", current.id).eq("user_id", user.id).in("source_type", ["manual", "official"]).select("id").maybeSingle(); if (error || !data) return databaseErrorState("No se pudo eliminar la señal.");
  await refreshSetMarketSignalsSafely(supabase, user.id, current.set_id); try { await updateSnapshots(current.set_id, user.id, supabase); } catch { return databaseErrorState("La señal se eliminó, pero no se pudieron actualizar los snapshots."); }
  revalidate(current.set_id); return { error: null };
}

export async function refreshMarketSignalsAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const setId = z.uuid().safeParse(formData.get("set_id")); if (!setId.success) return databaseErrorState("Colección no válida."); const { supabase, user } = await requireUser(); if (!await verifySet(setId.data, user.id, supabase)) return databaseErrorState("La colección no existe o no te pertenece.");
  try { await refreshSetMarketSignals(supabase, user.id, setId.data); await updateSnapshots(setId.data, user.id, supabase); } catch { return databaseErrorState("No se pudieron recalcular las señales internas."); }
  revalidate(setId.data); return { error: null };
}
