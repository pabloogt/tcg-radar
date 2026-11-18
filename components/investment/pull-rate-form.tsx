"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormInput, FormSelect } from "@/components/entity-form-fields";
import { FormSubmit } from "@/components/form-submit";
import { initialActionState, type ActionState } from "@/lib/crud/action-state";
import type { Tables } from "@/lib/supabase/database.types";

type SaveAction = (state: ActionState, formData: FormData) => Promise<ActionState>;
const categoryGroups = ["ANY_HIT", "HIGH_RARITY_HIT", "CHASE_TIER", "TOP_CHASE", "SPECIFIC_CARD", "SPECIAL_SLOT", "BOX_HIT", "OTHER"] as const;

export function PullRateForm({ action, sets, cards, rate, selectedSetId }: {
  action: SaveAction;
  sets: readonly Pick<Tables<"tcg_sets">, "id" | "name" | "tcg">[];
  cards: readonly Pick<Tables<"tcg_cards">, "id" | "set_id" | "name" | "card_number" | "variant_name">[];
  rate?: Tables<"set_pull_rates">;
  selectedSetId?: string;
}) {
  const [state, formAction] = useActionState(action, initialActionState); const errors = state.fieldErrors ?? {}; const setId = rate?.set_id ?? selectedSetId ?? "";
  const probabilityDefault = rate && rate.odds_numerator === null ? (rate.probability_ppm / 10_000).toLocaleString("es-ES", { maximumFractionDigits: 4 }) : "";
  return <form action={formAction} className="rounded-xl border bg-white p-5 sm:p-6">
    {rate ? <input type="hidden" name="id" value={rate.id} /> : null}
    <div className="grid gap-4 sm:grid-cols-2">
      <FormSelect label="Colección" name="set_id" defaultValue={setId} error={errors.set_id}><option value="">Seleccionar…</option>{sets.map((set) => <option key={set.id} value={set.id}>{set.name} · {set.tcg}</option>)}</FormSelect>
      <FormSelect label="Grupo" name="category_group" defaultValue={rate?.category_group ?? "ANY_HIT"} error={errors.category_group}>{categoryGroups.map((value) => <option key={value} value={value}>{value}</option>)}</FormSelect>
      <FormInput label="Categoría original" name="category" required maxLength={160} defaultValue={rate?.category ?? ""} error={errors.category} />
      <FormInput label="Subcategoría" name="subcategory" maxLength={160} defaultValue={rate?.subcategory ?? ""} error={errors.subcategory} />
      <FormSelect label="Carta específica (opcional)" name="card_id" defaultValue={rate?.card_id ?? ""} error={errors.card_id}><option value="">Ninguna</option>{cards.map((card) => <option key={card.id} value={card.id}>{card.name} · #{card.card_number}{card.variant_name ? ` · ${card.variant_name}` : ""}</option>)}</FormSelect>
      <div className="grid grid-cols-2 gap-2"><FormInput label="Odds numerador" name="odds_numerator" type="number" min={1} defaultValue={rate?.odds_numerator ?? 1} error={errors.odds_numerator} /><FormInput label="Odds denominador" name="odds_denominator" type="number" min={1} defaultValue={rate?.odds_denominator ?? ""} error={errors.odds_denominator} /></div>
      <FormInput label="Probabilidad (%) alternativa" name="probability" inputMode="decimal" placeholder="3,125" defaultValue={probabilityDefault} error={errors.probability} />
      <FormInput label="Sobres por hit (alternativa)" name="packs_per_hit" inputMode="decimal" placeholder="32" error={errors.packs_per_hit} />
      <FormInput label="Tamaño de muestra" name="sample_size" type="number" min={0} defaultValue={rate?.sample_size ?? ""} error={errors.sample_size} />
      <FormInput label="Fuente" name="source" required maxLength={120} defaultValue={rate?.source ?? "manual"} error={errors.source} />
      <FormSelect label="Tipo de fuente" name="source_type" defaultValue={rate?.source_type ?? "manual"} error={errors.source_type}><option value="official">Oficial</option><option value="community">Comunidad</option><option value="manual">Manual</option><option value="derived">Derivada</option><option value="external">Externa</option></FormSelect>
      <FormSelect label="Confianza declarada" name="confidence" defaultValue={rate?.confidence ?? ""} error={errors.confidence}><option value="">Sin declarar</option><option value="HIGH">Alta</option><option value="MEDIUM">Media</option><option value="LOW">Baja</option></FormSelect>
      <FormInput label="Observado el" name="observed_at" type="datetime-local" defaultValue={rate?.observed_at?.slice(0, 16) ?? ""} error={errors.observed_at} />
      <FormInput label="Grupo de resultados EV" name="outcome_group" maxLength={120} defaultValue={rate?.outcome_group ?? ""} error={errors.outcome_group} />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="mutually_exclusive" defaultChecked={rate?.mutually_exclusive ?? false} /> Resultado mutuamente excluyente</label>
      <div className="sm:col-span-2"><FormInput label="Nota de fuente" name="source_note" maxLength={1000} defaultValue={rate?.source_note ?? ""} error={errors.source_note} /></div>
    </div>
    {state.error ? <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{state.error}</p> : null}
    <p className="mt-4 text-xs text-slate-500">Usa odds, porcentaje o sobres por hit. Si indicas varios formatos deben representar la misma probabilidad.</p>
    <div className="mt-6 flex justify-end gap-3"><Link href="/investment/data" className="rounded-lg border px-4 py-2 text-sm font-semibold">Cancelar</Link><FormSubmit label="Guardar pull rate" /></div>
  </form>;
}
