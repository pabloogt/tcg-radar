"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormInput, FormSelect } from "@/components/entity-form-fields";
import { FormSubmit } from "@/components/form-submit";
import type { ActionState } from "@/lib/crud/action-state";
import { initialActionState } from "@/lib/crud/action-state";
import type { Tables } from "@/lib/supabase/database.types";

type ListingAction = (state: ActionState, formData: FormData) => Promise<ActionState>;
type Option = { id: string; name: string };
export function ListingForm({ action, listing, products, stores }: { action: ListingAction; listing?: Tables<"listings">; products: Option[]; stores: Option[] }) {
  const [state, formAction] = useActionState(action, initialActionState); const errors = state.fieldErrors ?? {};
  return <form action={formAction} className="rounded-xl border bg-white p-5 sm:p-6">{listing ? <input type="hidden" name="id" value={listing.id} /> : null}{state.error ? <p role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}<div className="grid gap-5 sm:grid-cols-2">
    <FormSelect label="Producto" name="product_id" required defaultValue={listing?.product_id ?? ""} error={errors.product_id}><option value="" disabled>Selecciona un producto</option>{products.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</FormSelect>
    <FormSelect label="Tienda" name="store_id" required defaultValue={listing?.store_id ?? ""} error={errors.store_id}><option value="" disabled>Selecciona una tienda</option>{stores.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</FormSelect>
    <div className="sm:col-span-2"><FormInput label="URL del listing" name="url" type="url" required maxLength={2048} defaultValue={listing?.url} error={errors.url} /></div>
    <FormInput label="Precio (€)" name="price_euros" required inputMode="decimal" placeholder="49,99" defaultValue={listing ? (listing.price_cents / 100).toFixed(2) : ""} error={errors.price_cents} />
    <FormInput label="Envío (€)" name="shipping_euros" required inputMode="decimal" placeholder={listing && !listing.shipping_known ? "Desconocido: introduce 0 o un coste" : "5,95"} defaultValue={listing ? listing.shipping_known ? (listing.shipping_cents / 100).toFixed(2) : "" : "0,00"} error={errors.shipping_cents} />
    <FormSelect label="Stock" name="stock_status" defaultValue={listing?.stock_status ?? "unknown"} error={errors.stock_status}><option value="in_stock">En stock</option><option value="out_of_stock">Agotado</option><option value="preorder">Preventa</option><option value="unknown">Desconocido</option></FormSelect>
    <FormInput label="Cantidad disponible" name="available_quantity" type="number" min={0} step={1} defaultValue={listing?.available_quantity ?? ""} error={errors.available_quantity} />
    <FormInput label="Vendedor" name="seller" maxLength={200} defaultValue={listing?.seller ?? ""} error={errors.seller} />
    <FormInput label="País (ISO)" name="country" required minLength={2} maxLength={2} defaultValue={listing?.country ?? "ES"} error={errors.country} />
  </div><div className="mt-6 flex justify-end gap-3"><Link href="/listings" className="rounded-lg border px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancelar</Link><FormSubmit label={listing ? "Guardar cambios" : "Crear listing"} /></div></form>;
}
