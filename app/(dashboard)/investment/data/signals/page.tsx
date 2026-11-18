import Link from "next/link";
import { DeleteButton } from "@/components/delete-button";
import { EmptyState } from "@/components/empty-state";
import { MarketSignalForm } from "@/components/investment/market-signal-form";
import { MarketSignalRefreshForm } from "@/components/investment/market-signal-refresh-form";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth/require-user";
import { createMarketSignal, deleteMarketSignal, refreshMarketSignalsAction } from "./actions";

const labels: Record<string, string> = { manual_demand: "Demanda manual", manual_hype: "Hype manual", manual_reprint_risk: "Riesgo de reimpresión", reprint_event: "Evento de suministro", official_reprint_announced: "Reimpresión oficial", official_restock_announced: "Reposición oficial", set_out_of_print: "Fuera de impresión", production_window_closed: "Producción cerrada", unknown_supply_status: "Suministro desconocido", demand_score: "Demanda derivada", reprint_risk: "Riesgo derivado" };

export default async function MarketSignalsDataPage({ searchParams }: { searchParams: Promise<{ set?: string }> }) {
  const filter = await searchParams; const { supabase, user } = await requireUser();
  const [{ data: sets }, { data: signals }] = await Promise.all([
    supabase.from("tcg_sets").select("id,name,tcg").eq("user_id", user.id).order("name").limit(500),
    supabase.from("set_market_signals").select("*").eq("user_id", user.id).order("observed_at", { ascending: false }).limit(250),
  ]);
  const orderedSets = [...(sets ?? [])].sort((left, right) => Number(right.id === filter.set) - Number(left.id === filter.set));
  const setMap = new Map((sets ?? []).map((set) => [set.id, set]));
  const selectedSet = orderedSets[0] ?? null;
  return <>
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4"><PageHeader title="Señales de mercado" description="Gestiona overrides privados de demanda, hype y reimpresión; las señales derivadas no se editan." /><Link href="/investment/data" className="rounded-lg border bg-white px-3 py-2 text-sm font-semibold">Volver a datos</Link></div>
    {orderedSets.length ? <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]"><MarketSignalForm action={createMarketSignal} sets={orderedSets} /><aside className="space-y-3"><div className="rounded-xl border bg-white p-4"><h2 className="font-semibold">Recálculo interno</h2><p className="mt-1 text-sm text-slate-500">Usa solo listings e histórico local de los últimos 90 días.</p>{selectedSet ? <div className="mt-4"><p className="mb-2 text-xs font-medium text-slate-500">{selectedSet.name}</p><MarketSignalRefreshForm action={refreshMarketSignalsAction} setId={selectedSet.id} /></div> : null}</div><div className="rounded-xl border bg-amber-50 p-4 text-sm text-amber-900"><strong>Separación estricta</strong><p className="mt-1">Hype no se deriva del stock. Una expansión de oferta se muestra como inferencia y nunca como reimpresión confirmada.</p></div></aside></div> : <EmptyState title="No hay colecciones" description="Crea primero un Set de inversión para añadir señales." action={{ label: "Nueva colección", href: "/investment/sets/new" }} />}
    <section className="mt-8"><div className="mb-3"><h2 className="text-lg font-semibold">Historial de señales</h2><p className="text-sm text-slate-500">Las observaciones se conservan para análisis temporal futuro.</p></div>{signals?.length ? <div className="divide-y overflow-hidden rounded-xl border bg-white">{signals.map((signal) => { const editable = signal.source_type === "manual" || signal.source_type === "official"; return <article key={signal.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"><div><p className="font-semibold">{labels[signal.signal_type] ?? signal.signal_type} · {signal.value}/100</p><p className="text-xs text-slate-500">{setMap.get(signal.set_id)?.name ?? "Set"} · {signal.source_type} · confianza {signal.confidence.toLowerCase()} · {new Date(signal.observed_at).toLocaleString("es-ES")}</p>{signal.note ? <p className="mt-1 max-w-2xl text-sm text-slate-600">{signal.note}</p> : null}</div>{editable ? <div className="flex items-center gap-3"><Link href={`/investment/data/signals/${signal.id}/edit`} className="text-xs font-semibold text-emerald-700">Editar</Link><DeleteButton id={signal.id} action={deleteMarketSignal} entityName="esta señal" /></div> : <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">Derivada · solo lectura</span>}</article>; })}</div> : <EmptyState title="Sin señales guardadas" description="Añade una señal manual o ejecuta el recálculo interno." />}</section>
  </>;
}
