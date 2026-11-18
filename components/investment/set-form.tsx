"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormInput, FormSelect } from "@/components/entity-form-fields";
import { FormSubmit } from "@/components/form-submit";
import { initialActionState, type ActionState } from "@/lib/crud/action-state";
import type { Tables } from "@/lib/supabase/database.types";

type SetAction = (state: ActionState, formData: FormData) => Promise<ActionState>;
export function SetForm({ action, set }: { action: SetAction; set?: Tables<"tcg_sets"> }) {
  const [state, formAction] = useActionState(action, initialActionState); const errors = state.fieldErrors ?? {};
  return <form action={formAction} className="rounded-xl border bg-white p-5 sm:p-6">{set ? <input type="hidden" name="id" value={set.id} /> : null}{state.error ? <p role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{state.error}</p> : null}<div className="grid gap-5 sm:grid-cols-2"><FormSelect label="TCG" name="tcg" defaultValue={set?.tcg ?? "pokemon"} error={errors.tcg}><option value="pokemon">Pokémon</option><option value="one_piece">One Piece</option><option value="lorcana">Disney Lorcana</option></FormSelect><FormInput label="Nombre de la colección" name="name" required maxLength={200} defaultValue={set?.name} error={errors.name} /><FormInput label="Serie / bloque" name="series" maxLength={200} defaultValue={set?.series ?? ""} error={errors.series} /><FormInput label="Fecha de lanzamiento" name="release_date" type="date" defaultValue={set?.release_date ?? ""} error={errors.release_date} /><FormInput label="Sobres por booster box" name="packs_per_booster_box" type="number" min={1} max={1000} defaultValue={set?.packs_per_booster_box ?? ""} error={errors.packs_per_booster_box} /><FormInput label="Cartas por sobre" name="cards_per_pack" type="number" min={1} max={1000} defaultValue={set?.cards_per_pack ?? ""} error={errors.cards_per_pack} /><div className="sm:col-span-2"><FormInput label="URL de imagen" name="image_url" type="url" maxLength={2048} defaultValue={set?.image_url ?? ""} error={errors.image_url} /></div></div><p className="mt-4 text-xs text-slate-500">La configuración de sobres es opcional y sólo habilita expectativas estadísticas por caja cuando el dato es conocido.</p><div className="mt-6 flex justify-end gap-3"><Link href={set ? `/investment/sets/${set.id}` : "/investment"} className="rounded-lg border px-4 py-2 text-sm font-semibold">Cancelar</Link><FormSubmit label={set ? "Guardar colección" : "Crear colección"} /></div></form>;
}
