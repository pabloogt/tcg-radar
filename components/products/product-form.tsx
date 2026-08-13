"use client";

import Link from "next/link";
import { useActionState } from "react";

import type { ActionState } from "@/lib/crud/action-state";
import { initialActionState } from "@/lib/crud/action-state";
import type { Tables } from "@/lib/supabase/database.types";
import { FormInput, FormSelect } from "@/components/entity-form-fields";
import { FormSubmit } from "@/components/form-submit";

type ProductAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

export function ProductForm({ action, product }: { action: ProductAction; product?: Tables<"products"> }) {
  const [state, formAction] = useActionState(action, initialActionState);
  const errors = state.fieldErrors ?? {};
  return <form action={formAction} className="rounded-xl border bg-white p-5 sm:p-6">
    {product ? <input type="hidden" name="id" value={product.id} /> : null}
    {state.error ? <p role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}
    <div className="grid gap-5 sm:grid-cols-2">
      <FormSelect label="TCG" name="tcg" defaultValue={product?.tcg ?? "pokemon"} error={errors.tcg}><option value="pokemon">Pokémon</option><option value="one_piece">One Piece</option><option value="lorcana">Disney Lorcana</option></FormSelect>
      <FormInput label="Nombre" name="name" required maxLength={200} defaultValue={product?.name} error={errors.name} />
      <FormInput label="Set" name="set_name" maxLength={200} defaultValue={product?.set_name ?? ""} error={errors.set_name} />
      <FormInput label="Tipo de producto" name="product_type" required maxLength={100} placeholder="Booster box, ETB…" defaultValue={product?.product_type} error={errors.product_type} />
      <FormInput label="Idioma" name="language" required maxLength={50} placeholder="Español" defaultValue={product?.language} error={errors.language} />
      <FormInput label="Fecha de lanzamiento" name="release_date" type="date" defaultValue={product?.release_date ?? ""} error={errors.release_date} />
      <FormInput label="PVP recomendado (€)" name="retail_price_euros" type="text" inputMode="decimal" placeholder="0,00" defaultValue={product?.retail_price_cents == null ? "" : (product.retail_price_cents / 100).toFixed(2)} error={errors.retail_price_cents} />
      <FormInput label="URL de imagen" name="image_url" type="url" maxLength={2048} defaultValue={product?.image_url ?? ""} error={errors.image_url} />
      <FormSelect label="Riesgo de reimpresión" name="reprint_risk" defaultValue={product?.reprint_risk ?? "unknown"} error={errors.reprint_risk}><option value="unknown">Desconocido</option><option value="low">Bajo</option><option value="medium">Medio</option><option value="high">Alto</option></FormSelect>
      <FormInput label="Demanda (0–100)" name="demand_score" type="number" min={0} max={100} step={1} defaultValue={product?.demand_score ?? ""} error={errors.demand_score} />
      <FormInput label="Largo plazo (0–100)" name="long_term_score" type="number" min={0} max={100} step={1} defaultValue={product?.long_term_score ?? ""} error={errors.long_term_score} />
    </div>
    <div className="mt-6 flex items-center justify-end gap-3"><Link href="/products" className="rounded-lg border px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancelar</Link><FormSubmit label={product ? "Guardar cambios" : "Crear producto"} /></div>
  </form>;
}
