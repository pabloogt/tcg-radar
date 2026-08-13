"use client";

import Link from "next/link";
import { useActionState } from "react";

import { FormInput, FormTextarea } from "@/components/entity-form-fields";
import { FormSubmit } from "@/components/form-submit";
import type { ActionState } from "@/lib/crud/action-state";
import { initialActionState } from "@/lib/crud/action-state";
import type { Tables } from "@/lib/supabase/database.types";

type StoreAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

export function StoreForm({ action, store }: { action: StoreAction; store?: Tables<"stores"> }) {
  const [state, formAction] = useActionState(action, initialActionState);
  const errors = state.fieldErrors ?? {};
  return <form action={formAction} className="rounded-xl border bg-white p-5 sm:p-6">
    {store ? <input type="hidden" name="id" value={store.id} /> : null}
    {state.error ? <p role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}
    <div className="grid gap-5 sm:grid-cols-2">
      <FormInput label="Nombre" name="name" required maxLength={200} defaultValue={store?.name} error={errors.name} />
      <FormInput label="Web" name="website_url" type="url" maxLength={2048} placeholder="https://…" defaultValue={store?.website_url ?? ""} error={errors.website_url} />
      <FormInput label="País (ISO)" name="country" required minLength={2} maxLength={2} placeholder="ES" defaultValue={store?.country ?? "ES"} error={errors.country} />
      <label className="flex items-center gap-3 self-end rounded-lg border px-3 py-2.5 text-sm font-medium text-slate-700"><input type="checkbox" name="active" defaultChecked={store?.active ?? true} className="size-4 accent-emerald-600" />Tienda activa</label>
      <div className="sm:col-span-2"><FormTextarea label="Notas de envío" name="shipping_notes" defaultValue={store?.shipping_notes ?? ""} error={errors.shipping_notes} /></div>
    </div>
    <div className="mt-6 flex items-center justify-end gap-3"><Link href="/stores" className="rounded-lg border px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancelar</Link><FormSubmit label={store ? "Guardar cambios" : "Crear tienda"} /></div>
  </form>;
}
