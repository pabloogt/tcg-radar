"use client";

import { useActionState } from "react";
import { FormInput, FormTextarea } from "@/components/entity-form-fields";
import { FormSubmit } from "@/components/form-submit";
import { initialActionState, type ActionState } from "@/lib/crud/action-state";
import type { Tables } from "@/lib/supabase/database.types";

type ProfileAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

export function ProductProfileForm({ action, productId, profile }: { action: ProfileAction; productId: string; profile: Tables<"product_investment_profiles"> | null }) {
  const [state, formAction] = useActionState(action, initialActionState);
  const errors = state.fieldErrors ?? {};
  const scoreFields = [["vehicle_score_override", "Override del Vehicle Score"], ["special_promo_score", "Fuerza de promo"], ["storage_efficiency_score", "Eficiencia de almacenamiento"], ["liquidity_score", "Liquidez"], ["sealed_collectability_score", "Coleccionabilidad sellada"]] as const;
  return <form action={formAction} className="rounded-xl border bg-white p-5"><input type="hidden" name="product_id" value={productId} /><h2 className="font-semibold">Perfil del vehículo de inversión</h2><p className="mt-1 text-sm text-slate-500">Opcional. El baseline por formato funciona sin completar este perfil.</p>{state.error ? <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{state.error}</p> : null}<div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{scoreFields.map(([name, label]) => <FormInput key={name} name={name} label={label} type="number" min={0} max={100} step={1} defaultValue={profile?.[name] ?? ""} error={errors[name]} />)}</div><div className="mt-5 flex flex-wrap gap-6"><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="exclusive" defaultChecked={profile?.exclusive ?? false} /> Producto exclusivo</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="limited_distribution" defaultChecked={profile?.limited_distribution ?? false} /> Distribución limitada</label></div><div className="mt-5"><FormTextarea name="notes" label="Notas" maxLength={1_000} defaultValue={profile?.notes ?? ""} error={errors.notes} /></div><div className="mt-5 flex justify-end"><FormSubmit label="Guardar perfil y snapshot" /></div></form>;
}
