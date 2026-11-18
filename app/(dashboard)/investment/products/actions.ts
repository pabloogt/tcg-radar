"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import { databaseErrorState, type ActionState, validationState } from "@/lib/crud/action-state";
import { loadProductInvestmentAnalyses } from "@/lib/investment/product-data";
import { persistProductInvestmentSnapshot } from "@/lib/investment/product-snapshots";
import { productInvestmentProfileSchema } from "@/lib/validation/investment";

function profileValues(formData: FormData) {
  return { vehicle_score_override: formData.get("vehicle_score_override"), exclusive: formData.get("exclusive") === "on", limited_distribution: formData.get("limited_distribution") === "on", special_promo_score: formData.get("special_promo_score"), storage_efficiency_score: formData.get("storage_efficiency_score"), liquidity_score: formData.get("liquidity_score"), sealed_collectability_score: formData.get("sealed_collectability_score"), notes: formData.get("notes") };
}

export async function saveProductInvestmentProfile(_state: ActionState, formData: FormData): Promise<ActionState> {
  const productId = z.uuid().safeParse(formData.get("product_id"));
  const parsed = productInvestmentProfileSchema.safeParse(profileValues(formData));
  if (!productId.success) return databaseErrorState("Producto no válido.");
  if (!parsed.success) return validationState(parsed.error);
  const { supabase, user } = await requireUser();
  const { data: product } = await supabase.from("products").select("id,set_id").eq("id", productId.data).eq("user_id", user.id).maybeSingle();
  if (!product?.set_id) return databaseErrorState("El producto no existe, no te pertenece o no tiene una colección vinculada.");
  const { error } = await supabase.from("product_investment_profiles").upsert({ user_id: user.id, product_id: product.id, ...parsed.data }, { onConflict: "product_id,user_id" });
  if (error) return databaseErrorState("No se pudo guardar el perfil de inversión.");
  try {
    const analysis = (await loadProductInvestmentAnalyses(supabase, user.id, { productIds: [product.id], limit: 1 }))[0];
    if (analysis) await persistProductInvestmentSnapshot(supabase, user.id, analysis);
  } catch {
    return databaseErrorState("El perfil se guardó, pero no se pudo crear el snapshot.");
  }
  revalidatePath(`/investment/products/${product.id}`);
  revalidatePath(`/investment/sets/${product.set_id}`);
  revalidatePath("/investment");
  revalidatePath("/dashboard");
  return { error: null };
}
