"use client";

import { useActionState } from "react";
import { FormInput, FormSelect, FormTextarea } from "@/components/entity-form-fields";
import { FormSubmit } from "@/components/form-submit";
import { initialActionState, type ActionState } from "@/lib/crud/action-state";
import { investmentMetricKeys, investmentMetricLabels } from "@/lib/investment/config";
import { metricsFromRow, provenanceFromJson } from "@/lib/investment/storage";
import type { Tables } from "@/lib/supabase/database.types";

type MetricsAction = (state: ActionState, formData: FormData) => Promise<ActionState>;
const rawFields = [
  ["top_card_price_euros", "Precio carta principal (€)", "top_card_price_cents"],
  ["top3_cards_value_euros", "Valor top 3 (€)", "top3_cards_value_cents"],
  ["top5_cards_value_euros", "Valor top 5 (€)", "top5_cards_value_cents"],
  ["top10_cards_value_euros", "Valor top 10 (€)", "top10_cards_value_cents"],
  ["cards_over_20_eur", "Cartas sobre 20 €", "cards_over_20_eur"],
  ["cards_over_50_eur", "Cartas sobre 50 €", "cards_over_50_eur"],
  ["cards_over_100_eur", "Cartas sobre 100 €", "cards_over_100_eur"],
  ["estimated_hit_rate_bps", "Hit rate estimado (bps)", "estimated_hit_rate_bps"],
  ["estimated_top_hit_rate_bps", "Top hit rate estimado (bps)", "estimated_top_hit_rate_bps"],
  ["stores_in_stock", "Tiendas con stock", "stores_in_stock"],
  ["stock_decline_30d_bps", "Caída de stock 30d (bps)", "stock_decline_30d_bps"],
  ["sealed_price_30d_change_bps", "Cambio sealed 30d (bps)", "sealed_price_30d_change_bps"],
  ["card_market_30d_change_bps", "Cambio cartas 30d (bps)", "card_market_30d_change_bps"],
] as const;

function rawDefault(row: Tables<"set_investment_metrics"> | null, column: (typeof rawFields)[number][2], euros: boolean) {
  const value = row?.[column];
  return typeof value === "number" ? euros ? (value / 100).toFixed(2).replace(".", ",") : value : "";
}

export function MetricsForm({ action, setId, row }: { action: MetricsAction; setId: string; row: Tables<"set_investment_metrics"> | null }) {
  const [state, formAction] = useActionState(action, initialActionState);
  const errors = state.fieldErrors ?? {};
  const metrics = metricsFromRow(row);
  const previousProvenance = Object.values(provenanceFromJson(row?.metric_provenance ?? null))[0];

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="set_id" value={setId} />
      {state.error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{state.error}</p> : null}
      <section className="rounded-xl border bg-white p-5">
        <h2 className="font-semibold">Editar métricas de inversión</h2>
        <p className="mt-1 text-sm text-slate-600">Valores normalizados de 0 a 100. Deja vacío lo que todavía no conozcas.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {investmentMetricKeys.map((key) => <FormInput key={key} label={investmentMetricLabels[key]} name={key} type="number" min={0} max={100} step={1} defaultValue={metrics[key] ?? ""} error={errors[key]} />)}
        </div>
      </section>
      <details className="rounded-xl border bg-white p-5">
        <summary className="cursor-pointer font-semibold">Métricas observables opcionales</summary>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rawFields.map(([name, label, column]) => <FormInput key={name} label={label} name={name} type="text" inputMode="decimal" defaultValue={rawDefault(row, column, name.endsWith("_euros"))} error={errors[column]} />)}
        </div>
      </details>
      <section className="rounded-xl border bg-white p-5">
        <h2 className="font-semibold">Procedencia de esta edición</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <FormSelect label="Tipo de fuente" name="source_type" defaultValue={previousProvenance?.sourceType ?? "manual"}>
            <option value="manual">Manual</option><option value="internal">Interna</option><option value="external">Externa</option><option value="derived">Derivada</option>
          </FormSelect>
          <FormSelect label="Confianza de la fuente" name="confidence" defaultValue={previousProvenance?.confidence.toLowerCase() ?? "medium"}>
            <option value="high">Alta</option><option value="medium">Media</option><option value="low">Baja</option>
          </FormSelect>
          <div className="sm:col-span-2"><FormTextarea label="Nota de fuente" name="source_note" maxLength={500} defaultValue={previousProvenance?.sourceNote ?? ""} placeholder="Ej.: observación manual de disponibilidad y cartas destacadas" /></div>
        </div>
        <p className="mt-3 text-xs text-slate-500">Esta procedencia se guarda por cada métrica poblada. Las métricas configuradas nunca son reemplazadas silenciosamente por señales derivadas.</p>
      </section>
      <div className="flex justify-end"><FormSubmit label="Guardar métricas y snapshot" /></div>
    </form>
  );
}
