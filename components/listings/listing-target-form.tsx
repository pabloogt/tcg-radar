"use client";

import { useState, useTransition } from "react";
import { deleteListingTargetAction, saveListingTargetAction, setListingTargetEnabledAction, type TargetActionResult } from "@/app/(dashboard)/listings/target-actions";

type Target = { target_price_cents: number; enabled: boolean } | null;

export function ListingTargetForm({ listingId, initialTarget }: { listingId: string; initialTarget: Target }) {
  const [target, setTarget] = useState(initialTarget);
  const [euros, setEuros] = useState(initialTarget ? (initialTarget.target_price_cents / 100).toFixed(2).replace(".", ",") : "");
  const [status, setStatus] = useState<TargetActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await saveListingTargetAction(listingId, euros);
      setStatus(result);
      if (result.ok) {
        const normalized = Number(euros.replace(",", "."));
        setTarget({ target_price_cents: Math.round(normalized * 100), enabled: true });
      }
    });
  }
  function toggle() {
    if (!target) return;
    startTransition(async () => {
      const result = await setListingTargetEnabledAction(listingId, !target.enabled);
      setStatus(result);
      if (result.ok) setTarget({ ...target, enabled: !target.enabled });
    });
  }
  function remove() {
    startTransition(async () => {
      const result = await deleteListingTargetAction(listingId);
      setStatus(result);
      if (result.ok) { setTarget(null); setEuros(""); }
    });
  }

  return <section className="mt-6 rounded-xl border bg-white p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold text-slate-950">Precio objetivo del listing</h2><p className="mt-1 text-sm text-slate-600">Avisa una sola vez cuando el precio cruce desde arriba hasta este importe o menos.</p></div>{target ? <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${target.enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{target.enabled ? "Activo" : "Desactivado"}</span> : null}</div><div className="mt-4 flex max-w-lg flex-wrap items-end gap-2"><label className="flex-1 text-sm font-medium text-slate-700">Objetivo (€)<input value={euros} onChange={(event) => setEuros(event.target.value)} inputMode="decimal" placeholder="50,00" className="mt-1.5 h-10 w-full rounded-lg border px-3 text-sm" /></label><button type="button" disabled={pending} onClick={save} className="h-10 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white disabled:opacity-50">Guardar</button>{target ? <><button type="button" disabled={pending} onClick={toggle} className="h-10 rounded-lg border px-3 text-sm font-semibold text-slate-700 disabled:opacity-50">{target.enabled ? "Desactivar" : "Activar"}</button><button type="button" disabled={pending} onClick={remove} className="h-10 rounded-lg border border-red-200 px-3 text-sm font-semibold text-red-700 disabled:opacity-50">Eliminar</button></> : null}</div>{status ? <p role="status" className={`mt-3 text-sm ${status.ok ? "text-emerald-700" : "text-red-700"}`}>{status.message}</p> : null}</section>;
}
