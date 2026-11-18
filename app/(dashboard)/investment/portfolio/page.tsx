import Link from "next/link";
import { DealBadge } from "@/components/deals/deal-badge";
import { EmptyState } from "@/components/empty-state";
import { FormSubmit } from "@/components/form-submit";
import { PortfolioForm, PortfolioHiddenFields } from "@/components/investment/portfolio-form";
import { PageHeader } from "@/components/page-header";
import { ProductThumbnail } from "@/components/product-thumbnail";
import { requireUser } from "@/lib/auth/require-user";
import { formatEuro, formatEuropeanDateTime } from "@/lib/formatters";
import { buildInvestmentPortfolio, type PortfolioResult } from "@/lib/investment/portfolio";
import { loadPortfolioBuilderData } from "@/lib/investment/portfolio-data";
import type { PortfolioStrategy } from "@/lib/investment/portfolio-config";
import { portfolioDefaults, portfolioInputSchema, portfolioOptions, type PortfolioFormInput } from "@/lib/validation/portfolio";
import { savePortfolioScenario } from "./actions";

type SearchParams = Record<string, string | string[] | undefined>;
const horizonLabels = { short: "Corto plazo", medium: "Medio plazo", long: "Largo plazo" } as const;
const strategyLabels = { CONSERVATIVE: "Conservadora", BALANCED: "Equilibrada", AGGRESSIVE: "Agresiva" } as const;
const confidenceLabels = { HIGH: "Alta", MEDIUM: "Media", LOW: "Baja", INSUFFICIENT: "Insuficiente" } as const;

function first(value: string | string[] | undefined): string | undefined { return Array.isArray(value) ? value[0] : value; }
function many(value: string | string[] | undefined): string[] { return value === undefined ? [] : Array.isArray(value) ? value : [value]; }

function inputFromSearchParams(params: SearchParams): { values: PortfolioFormInput; error: string | null } {
  const strategyValue = first(params.strategy);
  const strategy: PortfolioStrategy = strategyValue === "CONSERVATIVE" || strategyValue === "AGGRESSIVE" ? strategyValue : "BALANCED";
  const defaults = portfolioDefaults(strategy);
  if (first(params.generate) !== "1") return { values: defaults, error: null };
  const parsed = portfolioInputSchema.safeParse({
    budgetCents: first(params.budget),
    horizon: first(params.horizon),
    strategy,
    tcgs: many(params.tcgs),
    languages: many(params.languages),
    productTypes: many(params.productTypes),
    includePreorder: first(params.includePreorder) === "on",
    allowUnknownShipping: first(params.allowUnknownShipping) === "on",
    minimumScore: first(params.minimumScore) ?? defaults.minimumScore,
    minimumEntryConfidence: first(params.minimumEntryConfidence) ?? defaults.minimumEntryConfidence,
    maxProductPercent: first(params.maxProductPercent) ?? defaults.maxProductPercent,
    maxSetPercent: first(params.maxSetPercent) ?? defaults.maxSetPercent,
    maxTcgPercent: first(params.maxTcgPercent) ?? defaults.maxTcgPercent,
    maxUnitsPerProduct: first(params.maxUnitsPerProduct) ?? defaults.maxUnitsPerProduct,
    minimumDistinctProducts: first(params.minimumDistinctProducts) ?? null,
    maxDistinctProducts: first(params.maxDistinctProducts) ?? defaults.maxDistinctProducts,
  });
  return parsed.success ? { values: parsed.data, error: null } : { values: defaults, error: "Revisa el presupuesto, los filtros y los límites de diversificación." };
}

function AcquisitionPrice({ priceCents, shippingKnown }: { priceCents: number; shippingKnown: boolean }) {
  return <><strong>{formatEuro(priceCents)}</strong>{shippingKnown ? null : <span className="ml-1 text-xs font-normal text-amber-700">+ envío desconocido</span>}</>;
}

function PortfolioResults({ result, values }: { result: PortfolioResult; values: PortfolioFormInput }) {
  if (!result.positions.length) return <section className="mt-6"><EmptyState title="No hay una cartera suficientemente sólida" description="No hay productos disponibles con puntuación, confianza, frescura y coste compatibles con estos filtros. Prueba a relajar el score mínimo, incluir preventas, añadir otro TCG o ajustar el presupuesto." /></section>;
  const averageEntry = Math.round(result.positions.reduce((sum, position) => sum + (position.candidate.entryScore ?? 0) * position.totalCostCents, 0) / Math.max(result.allocatedCents, 1));
  return <section className="mt-6 space-y-5"><div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Propuesta para {formatEuro(result.budgetCents)}</p><h2 className="mt-1 text-xl font-semibold">{horizonLabels[result.horizon]} · {strategyLabels[result.strategy]}</h2><p className="mt-1 text-sm text-slate-600">Heurística explicable; no representa rentabilidad esperada ni garantizada.</p></div><div className="text-right"><p className="text-xs font-semibold uppercase text-slate-500">Portfolio Score</p><p className="text-3xl font-semibold">{result.portfolioScore ?? "—"}<span className="text-base text-slate-500">/100</span></p><p className="text-xs text-slate-500">Confianza {confidenceLabels[result.confidence].toLowerCase()}</p></div></div><div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-lg bg-white/80 p-3"><p className="text-xs text-slate-500">Capital utilizado</p><strong>{formatEuro(result.allocatedCents)}</strong></div><div className="rounded-lg bg-white/80 p-3"><p className="text-xs text-slate-500">Disponible</p><strong>{formatEuro(result.remainingCents)}</strong></div><div className="rounded-lg bg-white/80 p-3"><p className="text-xs text-slate-500">Entry Score medio</p><strong>{averageEntry}/100</strong></div></div></div>
    <div className="space-y-3">{result.positions.map((position, index) => <article key={position.candidate.productId} className="rounded-xl border bg-white p-5"><div className="flex flex-wrap gap-4"><ProductThumbnail imageUrl={position.candidate.imageUrl} name={position.candidate.productName} size="lg" /><div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase text-emerald-700">#{index + 1} · {position.candidate.tcg} · {position.candidate.language.toUpperCase()}</p><Link href={`/investment/products/${position.candidate.productId}`} className="mt-1 block text-lg font-semibold hover:text-emerald-700">{position.candidate.productName}</Link><p className="text-sm text-slate-500">{position.candidate.setName} · {position.candidate.productType}</p><div className="mt-3 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-slate-100 px-2.5 py-1">Investment {position.productInvestmentScore}/100</span><span className="rounded-full bg-slate-100 px-2.5 py-1">Set {position.setInvestmentScore ?? "—"}/100</span><span className="rounded-full bg-slate-100 px-2.5 py-1">Vehicle {position.candidate.vehicleScore}/100</span><span className="rounded-full bg-slate-100 px-2.5 py-1">Entry {position.candidate.entryScore ?? "—"}/100</span>{position.candidate.dealClassification ? <DealBadge classification={position.candidate.dealClassification} /> : null}</div></div><div className="min-w-44 text-right"><p className="text-sm text-slate-500">{position.quantity} {position.quantity === 1 ? "unidad" : "unidades"}</p><p className="text-lg font-semibold">{formatEuro(position.unitCostCents)} × {position.quantity}</p><p className="text-sm font-semibold text-emerald-700">{formatEuro(position.totalCostCents)}</p></div></div><div className="mt-4 grid gap-3 border-t pt-4 md:grid-cols-[1fr_auto]"><div><p className="text-sm font-semibold">Dónde comprar: {position.listing.storeName}</p><p className="mt-1 text-sm"><AcquisitionPrice priceCents={position.unitCostCents} shippingKnown={position.listing.shippingKnown} /> · {position.listing.stockStatus === "preorder" ? "Preventa" : "En stock"} · {position.listing.country}</p><p className="mt-1 text-xs text-slate-500">Revisado {formatEuropeanDateTime(position.listing.checkedAt)}</p></div><a href={position.listing.url} target="_blank" rel="noreferrer" className="self-center rounded-lg border px-3 py-2 text-sm font-semibold text-emerald-700">Ir a comprar ↗</a></div>{position.candidate.alternativeListings.length ? <details className="mt-3 text-sm"><summary className="cursor-pointer font-semibold text-slate-600">Alternativas de compra ({position.candidate.alternativeListings.length})</summary><div className="mt-2 grid gap-2 sm:grid-cols-2">{position.candidate.alternativeListings.slice(0, 4).map((listing) => <a key={listing.listingId} href={listing.url} target="_blank" rel="noreferrer" className="rounded-lg border bg-slate-50 p-3"><strong>{listing.storeName}</strong><p><AcquisitionPrice priceCents={listing.totalCostCents ?? listing.priceCents} shippingKnown={listing.shippingKnown} /></p><p className="text-xs text-slate-500">{listing.stockStatus === "preorder" ? "Preventa" : "Disponible"}</p></a>)}</div></details> : null}</article>)}</div>
    <div className="grid gap-4 lg:grid-cols-2"><article className="rounded-xl border bg-white p-5"><h3 className="font-semibold">Por qué esta cartera</h3><ul className="mt-3 space-y-2 text-sm text-slate-600">{result.reasons.map((reason) => <li key={reason}>+ {reason}</li>)}</ul></article><article className="rounded-xl border bg-white p-5"><h3 className="font-semibold">Advertencias</h3>{result.warnings.length ? <ul className="mt-3 space-y-2 text-sm text-amber-800">{result.warnings.map((warning) => <li key={warning}>– {warning}</li>)}</ul> : <p className="mt-3 text-sm text-slate-500">Sin advertencias adicionales.</p>}</article></div>
    {result.alternatives.length ? <article className="rounded-xl border bg-white p-5"><h3 className="font-semibold">Alternativas y productos a vigilar</h3><div className="mt-3 grid gap-2 md:grid-cols-2">{result.alternatives.map(({ candidate, reason, kind }) => <Link key={`${kind}-${candidate.productId}`} href={`/investment/products/${candidate.productId}`} className="rounded-lg border bg-slate-50 p-3"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{candidate.productName}</p><p className="text-xs text-slate-500">{candidate.setName} · {candidate.language.toUpperCase()}</p></div><span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${kind === "watch" ? "bg-amber-100 text-amber-800" : "bg-slate-200 text-slate-700"}`}>{kind === "watch" ? "Vigilar" : "Alternativa"}</span></div><p className="mt-2 text-xs text-slate-600">{reason}</p></Link>)}</div></article> : null}
    <form action={savePortfolioScenario} className="flex flex-col gap-3 rounded-xl border bg-white p-5 sm:flex-row sm:items-end"><PortfolioHiddenFields values={values} /><label className="min-w-0 flex-1 text-sm font-semibold">Nombre de la propuesta<input name="name" maxLength={120} required defaultValue={`Cartera ${horizonLabels[result.horizon]} · ${new Date().toLocaleDateString("es-ES")}`} className="mt-1 h-10 w-full rounded-lg border px-3 font-normal" /></label><FormSubmit label="Guardar propuesta" /></form>
  </section>;
}

export default async function InvestmentPortfolioPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const { values, error } = inputFromSearchParams(params);
  const { supabase, user } = await requireUser();
  const now = new Date();
  const [builderData, savedResponse] = await Promise.all([
    loadPortfolioBuilderData(supabase, user.id, now),
    supabase.from("investment_portfolios").select("id,name,budget_cents,allocated_cents,remaining_cents,horizon,strategy,portfolio_score,confidence,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(12),
  ]);
  const saved = savedResponse.data ?? [];
  const { data: savedPositions } = saved.length ? await supabase.from("investment_portfolio_positions").select("portfolio_id,quantity").eq("user_id", user.id).in("portfolio_id", saved.map((portfolio) => portfolio.id)) : { data: [] };
  const languages = [...new Set(builderData.candidates.map((candidate) => candidate.language))].sort();
  const productTypes = [...new Set(builderData.candidates.map((candidate) => candidate.productType))].sort();
  const result = first(params.generate) === "1" && !error ? buildInvestmentPortfolio({ candidates: builderData.candidates, options: portfolioOptions(values), existingExposure: builderData.existingExposure, now }) : null;
  const status = first(params.status);
  const statusMessage = status === "saved" ? "Propuesta guardada correctamente." : status === "invalid" ? "No se pudo guardar: configuración no válida." : status === "empty" ? "No hay posiciones válidas que guardar." : status === "database" ? "No se pudo guardar la propuesta en Supabase." : null;

  return <><div className="mb-6 flex flex-wrap items-start justify-between gap-4"><PageHeader title="Crear cartera de inversión" description="Combina oportunidades selladas conocidas según capital, horizonte, confianza y diversificación." /><Link href="/investment" className="rounded-lg border bg-white px-3 py-2 text-sm font-semibold">Volver al radar</Link></div>{statusMessage ? <p className={`mb-4 rounded-lg border p-3 text-sm ${status === "saved" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"}`}>{statusMessage}</p> : null}<PortfolioForm values={values} languages={languages} productTypes={productTypes} error={error} />{result ? <PortfolioResults result={result} values={values} /> : null}<section className="mt-8"><div className="mb-3"><h2 className="text-lg font-semibold">Mis carteras guardadas</h2><p className="text-sm text-slate-500">Snapshots de propuestas; no son compras ni modifican inventario.</p></div>{saved.length ? <div className="grid gap-3 md:grid-cols-2">{saved.map((portfolio) => { const units = (savedPositions ?? []).filter((position) => position.portfolio_id === portfolio.id).reduce((sum, position) => sum + position.quantity, 0); return <article key={portfolio.id} className="rounded-xl border bg-white p-4"><div className="flex items-start justify-between gap-4"><div><h3 className="font-semibold">{portfolio.name}</h3><p className="mt-1 text-xs text-slate-500">{formatEuropeanDateTime(portfolio.created_at)} · {horizonLabels[portfolio.horizon as keyof typeof horizonLabels] ?? portfolio.horizon}</p></div><p className="text-lg font-semibold">{portfolio.portfolio_score ?? "—"}/100</p></div><div className="mt-3 grid grid-cols-3 gap-2 text-xs"><div><p className="text-slate-500">Capital</p><strong>{formatEuro(portfolio.budget_cents)}</strong></div><div><p className="text-slate-500">Asignado</p><strong>{formatEuro(portfolio.allocated_cents)}</strong></div><div><p className="text-slate-500">Unidades</p><strong>{units}</strong></div></div></article>; })}</div> : <EmptyState title="No hay carteras guardadas" description="Genera una propuesta y guárdala para conservar sus scores, precios y tiendas como snapshot." />}</section><p className="mt-6 text-xs text-slate-500">El Portfolio Score es una heurística explicable, no una predicción de rentabilidad ni una recomendación financiera garantizada.</p></>;
}
