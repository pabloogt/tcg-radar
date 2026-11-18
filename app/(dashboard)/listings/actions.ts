"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth/require-user";
import { databaseErrorState, type ActionState, validationState } from "@/lib/crud/action-state";
import { listingFormSchema } from "@/lib/validation/crud";

function listingValues(formData: FormData) {
  return { product_id: formData.get("product_id"), store_id: formData.get("store_id"), url: formData.get("url"), price_cents: formData.get("price_euros"), shipping_cents: formData.get("shipping_euros"), stock_status: formData.get("stock_status"), available_quantity: formData.get("available_quantity"), seller: formData.get("seller"), country: formData.get("country") };
}

async function relationsBelongToUser(productId: string, storeId: string) {
  const { supabase, user } = await requireUser();
  const [{ data: product }, { data: store }] = await Promise.all([
    supabase.from("products").select("id").eq("id", productId).eq("user_id", user.id).maybeSingle(),
    supabase.from("stores").select("id").eq("id", storeId).eq("user_id", user.id).maybeSingle(),
  ]);
  return { supabase, user, valid: Boolean(product && store) };
}

export async function createListing(_state: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = listingFormSchema.safeParse(listingValues(formData));
  if (!parsed.success) return validationState(parsed.error);
  const { supabase, user, valid } = await relationsBelongToUser(parsed.data.product_id, parsed.data.store_id);
  if (!valid) return databaseErrorState("El producto o la tienda no existen o no te pertenecen.");
  const checkedAt = new Date().toISOString();
  const { data: listing, error } = await supabase.from("listings").insert({ ...parsed.data, price_cents: parsed.data.price_cents, shipping_known: true, user_id: user.id, checked_at: checkedAt }).select("id").single();
  if (error) return databaseErrorState("No se pudo crear el listing.");
  const { error: historyError } = await supabase.from("price_history").insert({ listing_id: listing.id, price_cents: parsed.data.price_cents, shipping_cents: parsed.data.shipping_cents, shipping_known: true, stock_status: parsed.data.stock_status, user_id: user.id, recorded_at: checkedAt });
  if (historyError) {
    await supabase.from("listings").delete().eq("id", listing.id).eq("user_id", user.id);
    return databaseErrorState("No se pudo crear el historial inicial del listing.");
  }
  revalidatePath("/listings"); revalidatePath(`/products/${parsed.data.product_id}`); revalidatePath(`/stores/${parsed.data.store_id}`);
  redirect("/listings");
}

export async function updateListing(_state: ActionState, formData: FormData): Promise<ActionState> {
  const id = z.uuid().safeParse(formData.get("id"));
  const parsed = listingFormSchema.safeParse(listingValues(formData));
  if (!id.success) return databaseErrorState("Listing no válido.");
  if (!parsed.success) return validationState(parsed.error);
  const { supabase, user, valid } = await relationsBelongToUser(parsed.data.product_id, parsed.data.store_id);
  if (!valid) return databaseErrorState("El producto o la tienda no existen o no te pertenecen.");
  const { data: current } = await supabase.from("listings").select("*").eq("id", id.data).eq("user_id", user.id).maybeSingle();
  if (!current) return databaseErrorState("El listing no existe o no te pertenece.");
  const checkedAt = new Date().toISOString();
  const { data, error } = await supabase.from("listings").update({ ...parsed.data, price_cents: parsed.data.price_cents, shipping_known: true, checked_at: checkedAt }).eq("id", id.data).eq("user_id", user.id).select("id").maybeSingle();
  if (error) return databaseErrorState("No se pudo actualizar el listing.");
  if (!data) return databaseErrorState("El listing no existe o no te pertenece.");
  if (current.price_cents !== parsed.data.price_cents || current.stock_status !== parsed.data.stock_status) {
    const { error: historyError } = await supabase.from("price_history").insert({ listing_id: id.data, price_cents: parsed.data.price_cents, shipping_cents: parsed.data.shipping_cents, shipping_known: true, stock_status: parsed.data.stock_status, user_id: user.id, recorded_at: checkedAt });
    if (historyError) return databaseErrorState("El listing se actualizó, pero no se pudo registrar su historial.");
  }
  revalidatePath("/listings"); revalidatePath(`/products/${current.product_id}`); revalidatePath(`/products/${parsed.data.product_id}`); revalidatePath(`/stores/${current.store_id}`); revalidatePath(`/stores/${parsed.data.store_id}`);
  redirect("/listings");
}

export async function deleteListing(_state: ActionState, formData: FormData): Promise<ActionState> {
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return databaseErrorState("Listing no válido.");
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase.from("listings").delete().eq("id", id.data).eq("user_id", user.id).select("product_id, store_id").maybeSingle();
  if (error) return databaseErrorState("No se pudo eliminar el listing.");
  if (!data) return databaseErrorState("El listing no existe o no te pertenece.");
  revalidatePath("/listings"); revalidatePath(`/products/${data.product_id}`); revalidatePath(`/stores/${data.store_id}`);
  return { error: null };
}
