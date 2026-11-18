"use client";

import { useActionState } from "react";
import { FormInput, FormSelect } from "@/components/entity-form-fields";
import { FormSubmit } from "@/components/form-submit";
import { initialActionState, type ActionState } from "@/lib/crud/action-state";
import type { Tables } from "@/lib/supabase/database.types";

type EditAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

export function CardEditForm({ card, action }: { card: Tables<"tcg_cards">; action: EditAction }) {
  const [state, formAction] = useActionState(action, initialActionState); const errors = state.fieldErrors ?? {};
  return <form action={formAction} className="rounded-xl border bg-white p-5"><input type="hidden" name="id" value={card.id} />{state.error ? <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{state.error}</p> : null}<div className="grid gap-4 sm:grid-cols-2"><FormInput name="name" label="Nombre" defaultValue={card.name} error={errors.name} /><FormInput name="card_number" label="Número" defaultValue={card.card_number} error={errors.card_number} /><FormInput name="rarity" label="Rareza original" defaultValue={card.rarity} error={errors.rarity} /><FormSelect name="rarity_group" label="Grupo normalizado" defaultValue={card.rarity_group ?? ""} error={errors.rarity_group}><option value="">Sin clasificar</option>{["common", "uncommon", "rare", "ultra", "special", "secret", "promo", "other"].map((value) => <option key={value}>{value}</option>)}</FormSelect><FormInput name="character_name" label="Personaje" defaultValue={card.character_name ?? ""} error={errors.character_name} /><FormInput name="variant_name" label="Variante" defaultValue={card.variant_name ?? ""} error={errors.variant_name} /></div><div className="mt-5 flex justify-end"><FormSubmit label="Guardar corrección" /></div></form>;
}
