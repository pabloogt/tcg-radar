"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { databaseErrorState, type ActionState, validationState } from "@/lib/crud/action-state";
import { requireUser } from "@/lib/auth/require-user";
import { productFormSchema } from "@/lib/validation/crud";
import { resolveProductSet } from "@/lib/investment/linking";

function productValues(formData: FormData) {
  return {
    tcg: formData.get("tcg"), name: formData.get("name"), set_name: formData.get("set_name"),
    product_type: formData.get("product_type"), language: formData.get("language"),
    release_date: formData.get("release_date"), retail_price_cents: formData.get("retail_price_euros"),
    image_url: formData.get("image_url"), reprint_risk: formData.get("reprint_risk"),
    demand_score: formData.get("demand_score"), long_term_score: formData.get("long_term_score"),
  };
}

async function resolveSetId(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"], userId: string, tcg: string, setName: string | null) {
  if (!setName) return null;
  const { data } = await supabase.from("tcg_sets").select("id,tcg,name,normalized_key").eq("user_id", userId).eq("tcg", tcg);
  return resolveProductSet({ tcg, setName }, (data ?? []).map((set) => ({ id: set.id, tcg: set.tcg, name: set.name, normalizedKey: set.normalized_key })))?.id ?? null;
}

export async function createProduct(_state: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = productFormSchema.safeParse(productValues(formData));
  if (!parsed.success) return validationState(parsed.error);

  const { supabase, user } = await requireUser();
  const setId = await resolveSetId(supabase, user.id, parsed.data.tcg, parsed.data.set_name);
  const { error } = await supabase.from("products").insert({ ...parsed.data, set_id: setId, user_id: user.id });
  if (error) return databaseErrorState("No se pudo crear el producto.");

  revalidatePath("/products");
  redirect("/products");
}

export async function updateProduct(_state: ActionState, formData: FormData): Promise<ActionState> {
  const id = z.uuid().safeParse(formData.get("id"));
  const parsed = productFormSchema.safeParse(productValues(formData));
  if (!id.success) return databaseErrorState("Producto no válido.");
  if (!parsed.success) return validationState(parsed.error);

  const { supabase, user } = await requireUser();
  const { data: current } = await supabase.from("products").select("id,set_id").eq("id", id.data).eq("user_id", user.id).maybeSingle();
  if (!current) return databaseErrorState("El producto no existe o no te pertenece.");
  const exactSetId = await resolveSetId(supabase, user.id, parsed.data.tcg, parsed.data.set_name);
  let setId = exactSetId;
  if (!setId && current.set_id) {
    const { data: assignedSet } = await supabase.from("tcg_sets").select("id,tcg").eq("id", current.set_id).eq("user_id", user.id).maybeSingle();
    if (assignedSet?.tcg === parsed.data.tcg) setId = assignedSet.id;
  }
  const { data, error } = await supabase.from("products").update({ ...parsed.data, set_id: setId }).eq("id", id.data).eq("user_id", user.id).select("id").maybeSingle();
  if (error) return databaseErrorState("No se pudo actualizar el producto.");
  if (!data) return databaseErrorState("El producto no existe o no te pertenece.");

  revalidatePath("/products");
  redirect("/products");
}

export async function deleteProduct(_state: ActionState, formData: FormData): Promise<ActionState> {
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return databaseErrorState("Producto no válido.");

  const { supabase, user } = await requireUser();
  const { data, error } = await supabase.from("products").delete().eq("id", id.data).eq("user_id", user.id).select("id").maybeSingle();
  if (error?.code === "23503") return databaseErrorState("No se puede eliminar: el producto está usado en listings o compras.");
  if (error) return databaseErrorState("No se pudo eliminar el producto.");
  if (!data) return databaseErrorState("El producto no existe o no te pertenece.");

  revalidatePath("/products");
  return { error: null };
}
