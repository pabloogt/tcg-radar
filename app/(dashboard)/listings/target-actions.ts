"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";

export type TargetActionResult = { ok: boolean; message: string };

const listingIdSchema = z.uuid();

function parseEuroCents(value: string): number | null {
  const match = /^(\d+)(?:[,.](\d{1,2}))?$/.exec(value.trim());
  if (!match) return null;
  const euros = Number(match[1]);
  const cents = Number((match[2] ?? "").padEnd(2, "0"));
  const total = euros * 100 + cents;
  return Number.isSafeInteger(total) && total <= 2_147_483_647 ? total : null;
}

export async function saveListingTargetAction(listingId: string, targetEuros: string): Promise<TargetActionResult> {
  const validId = listingIdSchema.safeParse(listingId);
  const targetPriceCents = parseEuroCents(targetEuros);
  if (!validId.success || targetPriceCents === null) return { ok: false, message: "Introduce un precio objetivo válido en euros." };
  const { supabase, user } = await requireUser();
  const { data: listing } = await supabase.from("listings").select("id").eq("id", validId.data).eq("user_id", user.id).maybeSingle();
  if (!listing) return { ok: false, message: "El listing no existe o no te pertenece." };
  const { error } = await supabase.from("listing_alert_targets").upsert({ user_id: user.id, listing_id: listing.id, target_price_cents: targetPriceCents, enabled: true }, { onConflict: "listing_id,user_id" });
  if (error) return { ok: false, message: "No se pudo guardar el precio objetivo." };
  revalidatePath(`/listings/${listing.id}/edit`);
  return { ok: true, message: "Precio objetivo guardado y activado." };
}

export async function setListingTargetEnabledAction(listingId: string, enabled: boolean): Promise<TargetActionResult> {
  const validId = listingIdSchema.safeParse(listingId);
  if (!validId.success) return { ok: false, message: "Listing no válido." };
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase.from("listing_alert_targets").update({ enabled }).eq("listing_id", validId.data).eq("user_id", user.id).select("id").maybeSingle();
  if (error || !data) return { ok: false, message: "No se pudo actualizar el objetivo." };
  revalidatePath(`/listings/${validId.data}/edit`);
  return { ok: true, message: enabled ? "Precio objetivo activado." : "Precio objetivo desactivado." };
}

export async function deleteListingTargetAction(listingId: string): Promise<TargetActionResult> {
  const validId = listingIdSchema.safeParse(listingId);
  if (!validId.success) return { ok: false, message: "Listing no válido." };
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("listing_alert_targets").delete().eq("listing_id", validId.data).eq("user_id", user.id);
  if (error) return { ok: false, message: "No se pudo eliminar el objetivo." };
  revalidatePath(`/listings/${validId.data}/edit`);
  return { ok: true, message: "Precio objetivo eliminado." };
}
