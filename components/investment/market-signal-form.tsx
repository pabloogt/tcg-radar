"use client";

import { useActionState } from "react";
import { FormInput, FormSelect, FormTextarea } from "@/components/entity-form-fields";
import { FormSubmit } from "@/components/form-submit";
import { initialActionState, type ActionState } from "@/lib/crud/action-state";
import type { Tables } from "@/lib/supabase/database.types";

type SignalAction = (state: ActionState, formData: FormData) => Promise<ActionState>;
type SetOption = { id: string; name: string; tcg: string };

const signalLabels = {
  manual_demand: "Override manual de demanda",
  manual_hype: "Hype manual",
  manual_reprint_risk: "Riesgo de reimpresión manual",
  reprint_event: "Evento de suministro / reimpresión",
  official_reprint_announced: "Reimpresión oficial anunciada",
  official_restock_announced: "Reposición oficial anunciada",
  set_out_of_print: "Señal de fuera de impresión",
  production_window_closed: "Ventana de producción cerrada",
  unknown_supply_status: "Estado de suministro desconocido",
} as const;

export function MarketSignalForm({ action, sets, row }: { action: SignalAction; sets: readonly SetOption[]; row?: Tables<"set_market_signals"> | null }) {
  const [state, formAction] = useActionState(action, initialActionState);
  const errors = state.fieldErrors ?? {};
  const observedAt = row?.observed_at ? row.observed_at.slice(0, 16) : new Date().toISOString().slice(0, 16);
  return <form action={formAction} className="space-y-5">
    {row ? <input type="hidden" name="id" value={row.id} /> : null}
    {state.error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{state.error}</p> : null}
    <section className="rounded-xl border bg-white p-5">
      <h2 className="font-semibold">{row ? "Editar señal manual" : "Añadir señal de mercado"}</h2>
      <p className="mt-1 text-sm text-slate-500">Demanda, hype y riesgo de reimpresión se guardan por separado y con procedencia.</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <FormSelect label="Colección" name="set_id" defaultValue={row?.set_id ?? sets[0]?.id} error={errors.set_id}>{sets.map((set) => <option key={set.id} value={set.id}>{set.name} · {set.tcg}</option>)}</FormSelect>
        <FormSelect label="Tipo de señal" name="signal_type" defaultValue={row?.signal_type ?? "manual_hype"} error={errors.signal_type}>{Object.entries(signalLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</FormSelect>
        <FormInput label="Valor normalizado (0–100)" name="value" type="number" min={0} max={100} step={1} defaultValue={row?.value ?? 50} error={errors.value} />
        <FormSelect label="Confianza" name="confidence" defaultValue={row?.confidence ?? "MEDIUM"} error={errors.confidence}><option value="HIGH">Alta</option><option value="MEDIUM">Media</option><option value="LOW">Baja</option></FormSelect>
        <FormSelect label="Procedencia" name="source_type" defaultValue={row?.source_type ?? "manual"} error={errors.source_type}><option value="manual">Manual</option><option value="official">Fuente oficial verificada manualmente</option></FormSelect>
        <FormInput label="Clave de fuente (opcional)" name="source_key" defaultValue={row?.source_key ?? ""} maxLength={120} placeholder="Ej.: pokemon_official" error={errors.source_key} />
        <FormInput label="Observado el" name="observed_at" type="datetime-local" defaultValue={observedAt} error={errors.observed_at} />
        <FormInput label="Tamaño de muestra (opcional)" name="sample_size" type="number" min={0} step={1} defaultValue={row?.sample_size ?? ""} error={errors.sample_size} />
      </div>
    </section>
    <details className="rounded-xl border bg-white p-5" open={Boolean(row?.reprint_status || row?.confirmed_reprint)}>
      <summary className="cursor-pointer font-semibold">Datos de reimpresión</summary>
      <p className="mt-2 text-sm text-slate-500">Solo para señales de suministro. Una expansión inferida nunca equivale a confirmación oficial.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <FormSelect label="Estado" name="reprint_status" defaultValue={row?.reprint_status ?? ""} error={errors.reprint_status}><option value="">Sin estado</option><option value="LOW_RISK">Riesgo bajo</option><option value="MODERATE_RISK">Riesgo moderado</option><option value="HIGH_RISK">Riesgo alto</option><option value="CONFIRMED_REPRINT">Reimpresión confirmada</option><option value="UNKNOWN">Desconocido</option></FormSelect>
        <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium text-slate-700"><input type="checkbox" name="confirmed_reprint" value="true" defaultChecked={row?.confirmed_reprint ?? false} /> Reimpresión confirmada explícitamente</label>
        <FormInput label="Fecha de anuncio (opcional)" name="announcement_date" type="date" defaultValue={row?.announcement_date ?? ""} error={errors.announcement_date} />
        <FormInput label="Suministro esperado (opcional)" name="expected_supply_date" type="date" defaultValue={row?.expected_supply_date ?? ""} error={errors.expected_supply_date} />
      </div>
    </details>
    <section className="rounded-xl border bg-white p-5"><FormTextarea label="Nota (opcional)" name="note" maxLength={1000} defaultValue={row?.note ?? ""} placeholder="Contexto o motivo de la señal" error={errors.note} /></section>
    <div className="flex justify-end"><FormSubmit label={row ? "Guardar señal" : "Añadir señal"} /></div>
  </form>;
}
