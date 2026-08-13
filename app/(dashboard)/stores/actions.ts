"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth/require-user";
import { databaseErrorState, type ActionState, validationState } from "@/lib/crud/action-state";
import { storeFormSchema } from "@/lib/validation/crud";

function storeValues(formData: FormData) {
  return { name: formData.get("name"), website_url: formData.get("website_url"), country: formData.get("country"), shipping_notes: formData.get("shipping_notes"), active: formData.get("active") };
}

export async function createStore(_state: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = storeFormSchema.safeParse(storeValues(formData));
  if (!parsed.success) return validationState(parsed.error);
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("stores").insert({ ...parsed.data, user_id: user.id });
  if (error) return databaseErrorState("No se pudo crear la tienda.");
  revalidatePath("/stores");
  redirect("/stores");
}

export async function updateStore(_state: ActionState, formData: FormData): Promise<ActionState> {
  const id = z.uuid().safeParse(formData.get("id"));
  const parsed = storeFormSchema.safeParse(storeValues(formData));
  if (!id.success) return databaseErrorState("Tienda no válida.");
  if (!parsed.success) return validationState(parsed.error);
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase.from("stores").update(parsed.data).eq("id", id.data).eq("user_id", user.id).select("id").maybeSingle();
  if (error) return databaseErrorState("No se pudo actualizar la tienda.");
  if (!data) return databaseErrorState("La tienda no existe o no te pertenece.");
  revalidatePath("/stores");
  redirect("/stores");
}

export async function deleteStore(_state: ActionState, formData: FormData): Promise<ActionState> {
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return databaseErrorState("Tienda no válida.");
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase.from("stores").delete().eq("id", id.data).eq("user_id", user.id).select("id").maybeSingle();
  if (error?.code === "23503") return databaseErrorState("No se puede eliminar: la tienda está usada en uno o más listings.");
  if (error) return databaseErrorState("No se pudo eliminar la tienda.");
  if (!data) return databaseErrorState("La tienda no existe o no te pertenece.");
  revalidatePath("/stores");
  return { error: null };
}
