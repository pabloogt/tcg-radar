"use client";

import { useState, useTransition } from "react";
import { formatEuro, formatEuropeanDateTime } from "@/lib/formatters";
import { runPokemillonDryAction, runPokemillonIngestAction, type MonitorActionResult } from "@/app/(dashboard)/settings/monitors/actions";

const initialState: MonitorActionResult = { ok: false, error: null, result: null };

function SummaryItem({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg border bg-slate-50 px-3 py-2"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-0.5 text-lg font-semibold text-slate-900">{value}</dd></div>;
}

type ScheduledRunView = { status: string; started_at: string; finished_at: string | null; alerts_sent: number; errors_count: number };

export function PokemillonCard({ automaticConfigured = false, scheduledStatus = { lastRun: null, lastSuccessfulRun: null } }: { automaticConfigured?: boolean; scheduledStatus?: { lastRun: ScheduledRunView | null; lastSuccessfulRun: ScheduledRunView | null } }) {
  const [state, setState] = useState(initialState);
  const [pending, startTransition] = useTransition();

  function execute(mode: "dry" | "ingest") {
    startTransition(async () => setState(await (mode === "dry" ? runPokemillonDryAction() : runPokemillonIngestAction())));
  }

  const result = state.result;
  return (
    <section className="overflow-hidden rounded-xl border bg-white shadow-sm shadow-slate-900/5">
      <div className="flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-slate-950">Pokemillon</h2>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Manual</span>
          </div>
          <p className="mt-1 text-sm text-slate-600">Catálogo público de Pokémon y One Piece · España</p>
          <a className="mt-2 inline-block text-xs font-medium text-emerald-700 hover:underline" href="https://www.pokemillon.com" target="_blank" rel="noreferrer">www.pokemillon.com ↗</a>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={pending} onClick={() => execute("dry")} className="rounded-lg border px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60">{pending ? "Ejecutando…" : "Ejecutar prueba seca"}</button>
          <button type="button" disabled={pending} onClick={() => execute("ingest")} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60">Ejecutar e ingerir</button>
        </div>
      </div>

      <dl className="grid gap-2 border-b bg-slate-50/60 p-5 text-sm sm:grid-cols-3 lg:grid-cols-6">
        <div><dt className="text-xs text-slate-500">Monitorización automática</dt><dd className={`mt-1 font-semibold ${automaticConfigured ? "text-emerald-700" : "text-amber-700"}`}>{automaticConfigured ? "Configurada" : "No configurada"}</dd></div>
        <div><dt className="text-xs text-slate-500">Última ejecución programada</dt><dd className="mt-1 font-semibold">{scheduledStatus.lastRun ? formatEuropeanDateTime(scheduledStatus.lastRun.started_at) : "—"}</dd></div>
        <div><dt className="text-xs text-slate-500">Último estado</dt><dd className="mt-1 font-semibold">{scheduledStatus.lastRun?.status ?? "—"}</dd></div>
        <div><dt className="text-xs text-slate-500">Última ejecución correcta</dt><dd className="mt-1 font-semibold">{scheduledStatus.lastSuccessfulRun ? formatEuropeanDateTime(scheduledStatus.lastSuccessfulRun.finished_at ?? scheduledStatus.lastSuccessfulRun.started_at) : "—"}</dd></div>
        <div><dt className="text-xs text-slate-500">Alertas del último run</dt><dd className="mt-1 font-semibold">{scheduledStatus.lastRun?.alerts_sent ?? 0}</dd></div>
        <div><dt className="text-xs text-slate-500">Errores del último run</dt><dd className="mt-1 font-semibold">{scheduledStatus.lastRun?.errors_count ?? 0}</dd></div>
      </dl>

      {state.error ? <p role="alert" className="m-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}
      {!result ? <p className="p-5 text-sm text-slate-500">Todavía no se ha ejecutado en esta sesión. La prueba seca no escribe datos ni crea alertas.</p> : (
        <div className="space-y-5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>Última ejecución: {formatEuropeanDateTime(result.log.finishedAt)}</span>
            <span className={`rounded-full px-2 py-1 font-medium ${result.mode === "dry_run" ? "bg-sky-50 text-sky-700" : "bg-emerald-50 text-emerald-700"}`}>{result.mode === "dry_run" ? "Prueba seca · sin escrituras" : "Ingesta real"}</span>
          </div>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            <SummaryItem label="Páginas" value={result.log.pagesFetched} />
            <SummaryItem label="Productos vistos" value={result.log.productsSeen} />
            <SummaryItem label="Observaciones" value={result.log.observationsProduced} />
            <SummaryItem label="Omitidos" value={result.log.observationsSkipped} />
            <SummaryItem label="Pokémon" value={result.log.pokemon} />
            <SummaryItem label="One Piece" value={result.log.onePiece} />
          </dl>
          {result.mode === "ingest" ? (
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <SummaryItem label="Productos creados" value={result.ingestion.productsCreated} />
              <SummaryItem label="Listings creados" value={result.ingestion.listingsCreated} />
              <SummaryItem label="Listings actualizados" value={result.ingestion.listingsUpdated} />
              <SummaryItem label="Históricos creados" value={result.ingestion.priceHistoriesCreated} />
              <SummaryItem label="Tiendas creadas" value={result.ingestion.storesCreated} />
              <SummaryItem label="Alertas candidatas" value={result.ingestion.alertCandidates} />
              <SummaryItem label="Alertas enviadas" value={result.ingestion.alertsSent} />
              <SummaryItem label="Alertas duplicadas" value={result.ingestion.alertsDuplicate} />
              <SummaryItem label="Alertas fallidas" value={result.ingestion.alertsFailed} />
              <SummaryItem label="Coincidencias producto" value={result.ingestion.productsMatched} />
              <SummaryItem label="Errores" value={result.ingestion.errors} />
            </dl>
          ) : null}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-900">Productos descubiertos</h3>
            {result.observations.length === 0 ? <p className="rounded-lg border border-dashed p-4 text-sm text-slate-500">No se produjeron observaciones válidas.</p> : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="min-w-full divide-y text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-2">Producto</th><th className="px-3 py-2">TCG</th><th className="px-3 py-2">Idioma</th><th className="px-3 py-2">Precio</th><th className="px-3 py-2">Stock</th></tr></thead>
                  <tbody className="divide-y">{result.observations.slice(0, 50).map((observation) => <tr key={`${observation.sourceProductId}-${observation.product.language}`}><td className="max-w-md px-3 py-2"><a className="font-medium text-slate-900 hover:text-emerald-700" href={observation.listing.url} target="_blank" rel="noreferrer">{observation.product.name} ↗</a><div className="text-xs text-slate-500">{observation.product.productType} · envío desconocido</div></td><td className="px-3 py-2 text-slate-600">{observation.product.tcg}</td><td className="px-3 py-2 text-slate-600">{observation.product.language}</td><td className="whitespace-nowrap px-3 py-2 font-medium">{formatEuro(observation.listing.priceCents)}</td><td className="px-3 py-2 text-slate-600">{observation.listing.stockStatus}</td></tr>)}</tbody>
                </table>
              </div>
            )}
          </div>
          {result.errors.length > 0 ? <details className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><summary className="cursor-pointer font-medium">{result.errors.length} errores aislados</summary><ul className="mt-2 space-y-1 text-xs">{result.errors.slice(0, 20).map((error, index) => <li key={`${error.sourceUrl}-${index}`}>{error.stage}: {error.message} · {error.sourceUrl}</li>)}</ul></details> : null}
        </div>
      )}
    </section>
  );
}
