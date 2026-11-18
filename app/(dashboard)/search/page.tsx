import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { ProductThumbnail } from "@/components/product-thumbnail";
import { summarizeCurrentListings } from "@/lib/analytics/price-history";
import { requireUser } from "@/lib/auth/require-user";
import { formatEuro } from "@/lib/formatters";
import { searchProducts } from "@/lib/search/products";
import { DealBadge } from "@/components/deals/deal-badge";
import { DEFAULT_DEAL_THRESHOLDS, evaluateDeal } from "@/lib/market/deal";
import { calculateMarketReference } from "@/lib/market/reference";

const tcgLabels: Record<string, string> = { pokemon: "Pokémon", one_piece: "One Piece", lorcana: "Disney Lorcana" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q: rawQuery } = await searchParams;
  const query = rawQuery?.trim() ?? "";
  const { supabase, user } = await requireUser();
  const { data: rows, error } = await supabase.from("products").select("id,name,set_name,product_type,tcg,language,image_url").eq("user_id", user.id).order("name");
  const ranked = searchProducts((rows ?? []).map((product) => ({ ...product, setName: product.set_name, productType: product.product_type })), query).slice(0, 50);
  const productIds = ranked.map((result) => result.product.id);
  const { data: listingRows } = productIds.length ? await supabase.from("listings").select("id,product_id,store_id,price_cents,shipping_cents,shipping_known,stock_status,checked_at").eq("user_id", user.id).in("product_id", productIds) : { data: [] };
  const listingIds = (listingRows ?? []).map((listing) => listing.id);
  const thirtyDaysAgo = new Date(new Date().getTime() - 30 * 86_400_000).toISOString();
  const [{ data: historyRows }, { data: settings }] = await Promise.all([
    listingIds.length ? supabase.from("price_history").select("listing_id,price_cents,shipping_cents,shipping_known,stock_status,recorded_at").eq("user_id", user.id).in("listing_id", listingIds).gte("recorded_at", thirtyDaysAgo) : Promise.resolve({ data: [] }),
    supabase.from("deal_settings").select("good_price_bps,opportunity_bps,bargain_bps,expensive_bps").eq("user_id", user.id).maybeSingle(),
  ]);
  const productByListing = new Map((listingRows ?? []).map((listing) => [listing.id, listing.product_id]));
  const listingsByProduct = new Map<string, NonNullable<typeof listingRows>>();
  for (const listing of listingRows ?? []) listingsByProduct.set(listing.product_id, [...(listingsByProduct.get(listing.product_id) ?? []), listing]);
  const historyByProduct = new Map<string, NonNullable<typeof historyRows>>();
  for (const history of historyRows ?? []) { const productId = productByListing.get(history.listing_id); if (productId) historyByProduct.set(productId, [...(historyByProduct.get(productId) ?? []), history]); }
  const thresholds = settings ? { goodPriceBps: settings.good_price_bps, opportunityBps: settings.opportunity_bps, bargainBps: settings.bargain_bps, expensiveBps: settings.expensive_bps } : DEFAULT_DEAL_THRESHOLDS;

  return <><div className="mb-5"><p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Catálogo privado</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Búsqueda global</h1><p className="mt-1 text-sm text-slate-600">Encuentra un producto normalizado y compara todas sus tiendas.</p></div><form className="mb-6 flex gap-2 rounded-xl border bg-white p-3"><label htmlFor="global-search" className="sr-only">Buscar productos</label><input id="global-search" name="q" defaultValue={query} autoFocus placeholder="ETB Oscuridad Absoluta, booster box, One Piece…" className="h-10 min-w-0 flex-1 rounded-lg border px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" /><button className="rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700">Buscar</button></form>
    {error ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">No se pudo completar la búsqueda.</p> : !query ? <EmptyState title="Busca en todo tu catálogo" description="Puedes usar el nombre, set, tipo, TCG o idioma del producto." /> : ranked.length === 0 ? <EmptyState title="Sin coincidencias" description="Prueba con menos palabras o con el nombre del set." /> : <div className="space-y-3">{ranked.map(({ product }) => { const productListings = listingsByProduct.get(product.id) ?? []; const comparable = productListings.map((listing) => ({ id: listing.id, storeId: listing.store_id, priceCents: listing.price_cents, shippingCents: listing.shipping_cents, shippingKnown: listing.shipping_known, stockStatus: listing.stock_status, checkedAt: listing.checked_at })); const summary = summarizeCurrentListings(comparable); const market = calculateMarketReference({ productId: product.id, currentListings: productListings.map((listing) => ({ productId: product.id, listingId: listing.id, storeId: listing.store_id, priceCents: listing.price_cents, shippingCents: listing.shipping_known ? listing.shipping_cents : null, shippingKnown: listing.shipping_known, stockStatus: listing.stock_status, observedAt: listing.checked_at })), history: (historyByProduct.get(product.id) ?? []).map((entry) => ({ productId: product.id, listingId: entry.listing_id, priceCents: entry.price_cents, shippingCents: entry.shipping_cents, shippingKnown: entry.shipping_known, stockStatus: entry.stock_status, observedAt: entry.recorded_at })) }).reference; const selected = market?.comparisonBasis === "BASE_PRICE" ? summary.lowestBase : summary.bestConfirmed; const deal = market && selected ? evaluateDeal({ listingId: selected.id, productId: product.id, priceCents: selected.priceCents, shippingCents: selected.shippingKnown ? selected.shippingCents : null, shippingKnown: selected.shippingKnown, stockStatus: selected.stockStatus }, market, thresholds) : null; return <Link key={product.id} href={`/products/${product.id}`} className="flex items-center justify-between gap-4 rounded-xl border bg-white p-4 transition hover:border-emerald-300 hover:shadow-sm"><div className="flex min-w-0 items-center gap-3"><ProductThumbnail imageUrl={product.image_url} name={product.name} size="lg" /><div className="min-w-0"><h2 className="truncate font-semibold text-slate-950">{product.name}</h2><p className="mt-1 text-xs text-slate-500">{product.set_name ?? "Sin set"}</p><div className="mt-2 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-emerald-50 px-2 py-1 font-semibold text-emerald-800">{tcgLabels[product.tcg] ?? product.tcg}</span><span className="rounded-full bg-slate-100 px-2 py-1">{product.language.toUpperCase()}</span><span className="rounded-full bg-slate-100 px-2 py-1">{product.product_type}</span></div></div></div><div className="shrink-0 text-right text-sm">{selected ? <><p className="font-semibold text-emerald-700">{formatEuro(selected.shippingKnown ? selected.priceCents + selected.shippingCents : selected.priceCents)}</p><p className="text-xs text-slate-500">{selected.shippingKnown ? "Mejor total confirmado" : "Precio base · envío desconocido"}</p>{market ? <p className="mt-1 text-xs text-slate-500">Mercado: {formatEuro(market.referencePriceCents)}</p> : null}{deal?.classification ? <span className="mt-2 inline-block"><DealBadge classification={deal.classification} /></span> : null}</> : <p className="text-slate-500">Sin precio disponible</p>}</div></Link>; })}</div>}
  </>;
}
