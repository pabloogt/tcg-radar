"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import { databaseErrorState, type ActionState, validationState } from "@/lib/crud/action-state";
import { normalizedCardKey } from "@/lib/cards/normalization";
import { persistEffectiveSetSnapshot } from "@/lib/investment/set-snapshots";
import { cardManualEditSchema } from "@/lib/validation/cards";

export async function updateCard(_state: ActionState, formData: FormData): Promise<ActionState> {
  const id = z.uuid().safeParse(formData.get("id")); const parsed = cardManualEditSchema.safeParse({ name: formData.get("name"), card_number: formData.get("card_number"), rarity: formData.get("rarity"), rarity_group: formData.get("rarity_group"), character_name: formData.get("character_name"), variant_name: formData.get("variant_name") });
  if (!id.success) return databaseErrorState("Carta no válida."); if (!parsed.success) return validationState(parsed.error);
  const { supabase, user } = await requireUser(); const { data: current } = await supabase.from("tcg_cards").select("id,set_id").eq("id", id.data).eq("user_id", user.id).maybeSingle(); if (!current) return databaseErrorState("La carta no existe o no te pertenece.");
  const { error } = await supabase.from("tcg_cards").update({ ...parsed.data, normalized_key: normalizedCardKey({ name: parsed.data.name, rarity: parsed.data.rarity, variantName: parsed.data.variant_name }) }).eq("id", current.id).eq("user_id", user.id);
  if (error?.code === "23505") return databaseErrorState("La corrección colisiona con otra variante ya existente."); if (error) return databaseErrorState("No se pudo actualizar la carta.");
  try { await persistEffectiveSetSnapshot(supabase, user.id, current.set_id); } catch { return databaseErrorState("La carta se actualizó, pero no se pudo refrescar el snapshot."); }
  revalidatePath("/investment/data"); revalidatePath(`/investment/data/cards/${current.id}/edit`); revalidatePath(`/investment/sets/${current.set_id}`); revalidatePath("/investment/cards"); return { error: null };
}
