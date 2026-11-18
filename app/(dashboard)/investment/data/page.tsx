import Link from "next/link";
import { CardImportForm } from "@/components/investment/card-import-form";
import { PullRateImportForm } from "@/components/investment/pull-rate-import-form";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth/require-user";
import { importCardData } from "./actions";
import { importPullRateData } from "./pull-rates/actions";

export default async function InvestmentDataPage() {
  const { supabase, user } = await requireUser();
  const [{ data: sets }, { data: cards }, { data: pullRates }] = await Promise.all([
    supabase.from("tcg_sets").select("id,name,tcg").eq("user_id", user.id).order("name").limit(500),
    supabase.from("tcg_cards").select("id,set_id,name,card_number,rarity,variant_name,updated_at").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(100),
    supabase.from("set_pull_rates").select("id,set_id,category,category_group,probability_ppm,source,confidence,updated_at").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(100),
  ]);
  const setMap = new Map((sets ?? []).map((set) => [set.id, set]));

  return <>
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <PageHeader title="Datos de inversión" description="Importa cartas, precios y pull rates normalizados sin depender de proveedores externos." />
      <div className="flex flex-wrap gap-2"><Link href="/investment/data/signals" className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">Señales de mercado</Link><Link href="/investment/data/pull-rates/new" className="rounded-lg border bg-white px-3 py-2 text-sm font-semibold">Añadir pull rate</Link><Link href="/investment" className="rounded-lg border bg-white px-3 py-2 text-sm font-semibold">Volver al radar</Link></div>
    </div>
    <div className="grid gap-4 xl:grid-cols-2">
      <CardImportForm kind="cards" sets={sets ?? []} action={importCardData} title="Catálogo de cartas" description="CSV/JSON: name, card_number, rarity, rarity_group, character_name, variant_name, image_url, external_id." />
      <CardImportForm kind="prices" sets={sets ?? []} action={importCardData} title="Precios de cartas" description="CSV/JSON: external_id o card_number, source, currency, price/market_price, low_price, trend_price, observed_at." />
      <PullRateImportForm sets={sets ?? []} action={importPullRateData} />
    </div>
    <section className="mt-8">
      <div className="mb-3"><h2 className="text-lg font-semibold">Pull rates recientes</h2><p className="text-sm text-slate-500">Probabilidades normalizadas en partes por millón; cada fila conserva su fuente.</p></div>
      {pullRates?.length ? <div className="divide-y overflow-hidden rounded-xl border bg-white">{pullRates.map((rate) => <div key={rate.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"><div><p className="font-semibold">{rate.category}</p><p className="text-xs text-slate-500">{setMap.get(rate.set_id)?.name ?? "Set"} · {rate.category_group} · {(rate.probability_ppm / 10_000).toLocaleString("es-ES", { maximumFractionDigits: 4 })}% · {rate.source}</p></div><Link href={`/investment/data/pull-rates/${rate.id}/edit`} className="text-sm font-semibold text-emerald-700">Editar</Link></div>)}</div> : <EmptyState title="No hay pull rates" description="Añade una observación manual o previsualiza una importación CSV/JSON." />}
    </section>
    <section className="mt-8">
      <div className="mb-3"><h2 className="text-lg font-semibold">Cartas importadas recientemente</h2><p className="text-sm text-slate-500">Catálogo de mercado; no representa tu colección personal.</p></div>
      {cards?.length ? <div className="overflow-hidden rounded-xl border bg-white"><div className="divide-y">{cards.map((card) => <div key={card.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"><div><p className="font-semibold">{card.name}</p><p className="text-xs text-slate-500">{setMap.get(card.set_id)?.name ?? "Set"} · #{card.card_number} · {card.rarity}{card.variant_name ? ` · ${card.variant_name}` : ""}</p></div><Link href={`/investment/data/cards/${card.id}/edit`} className="text-sm font-semibold text-emerald-700">Corregir</Link></div>)}</div></div> : <EmptyState title="No hay cartas importadas" description="Ejecuta primero una previsualización y después importa un catálogo validado." />}
    </section>
  </>;
}
