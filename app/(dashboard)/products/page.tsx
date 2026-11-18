import Link from "next/link";

import { DeleteButton } from "@/components/delete-button";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { deleteProduct } from "@/app/(dashboard)/products/actions";
import { requireUser } from "@/lib/auth/require-user";
import { formatEuro } from "@/lib/formatters";

const tcgLabels: Record<string, string> = { pokemon: "Pokémon", one_piece: "One Piece", lorcana: "Lorcana" };
const riskLabels: Record<string, string> = { low: "Bajo", medium: "Medio", high: "Alto", unknown: "Desconocido" };

type Props = { searchParams: Promise<{ q?: string; tcg?: string; language?: string }> };

export default async function ProductsPage({ searchParams }: Props) {
  const filters = await searchParams;
  const q = filters.q?.trim() ?? "";
  const { supabase, user } = await requireUser();
  let query = supabase.from("products").select("*").eq("user_id", user.id).order("name");
  if (q) query = query.ilike("name", `%${q}%`);
  if (filters.tcg) query = query.eq("tcg", filters.tcg);
  if (filters.language) query = query.eq("language", filters.language);
  const [{ data: products, error }, { data: languageRows }] = await Promise.all([
    query,
    supabase.from("products").select("language").eq("user_id", user.id).order("language"),
  ]);
  const languages = [...new Set((languageRows ?? []).map((row) => row.language))];

  return <><div className="flex items-start justify-between gap-4"><PageHeader title="Products" description="Manage the sealed TCG products you want to follow." /><Link href="/products/new" className="shrink-0 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Nuevo producto</Link></div>
    <form className="mb-4 grid gap-3 rounded-xl border bg-white p-3 sm:grid-cols-[1fr_180px_180px_auto]">
      <input name="q" defaultValue={q} placeholder="Buscar por nombre" className="h-9 rounded-lg border px-3 text-sm" />
      <select name="tcg" defaultValue={filters.tcg ?? ""} className="h-9 rounded-lg border px-2 text-sm"><option value="">Todos los TCG</option><option value="pokemon">Pokémon</option><option value="one_piece">One Piece</option><option value="lorcana">Lorcana</option></select>
      <select name="language" defaultValue={filters.language ?? ""} className="h-9 rounded-lg border px-2 text-sm"><option value="">Todos los idiomas</option>{languages.map((language) => <option key={language}>{language}</option>)}</select>
      <button className="rounded-lg border px-3 text-sm font-semibold hover:bg-slate-50">Filtrar</button>
    </form>
    {products?.some((product) => product.set_name && !product.set_id) ? <Link href="/investment/unlinked" className="mb-4 inline-flex rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">Set sin vincular · revisar productos</Link> : null}
    {error ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">No se pudieron cargar los productos.</p> : products?.length ? <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full min-w-[980px] text-left text-sm"><thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Producto</th><th className="px-4 py-3">TCG / Tipo</th><th className="px-4 py-3">Idioma</th><th className="px-4 py-3">PVP</th><th className="px-4 py-3">Reimpresión</th><th className="px-4 py-3">Demanda</th><th className="px-4 py-3">Largo plazo</th><th className="px-4 py-3 text-right">Acciones</th></tr></thead><tbody className="divide-y">{products.map((product) => <tr key={product.id} className="align-top"><td className="px-4 py-3"><div className="flex items-center gap-3">{product.image_url ? <span role="img" aria-label={`Imagen de ${product.name}`} className="size-10 shrink-0 rounded-lg border bg-slate-100 bg-cover bg-center" style={{ backgroundImage: `url(${JSON.stringify(product.image_url)})` }} /> : <span aria-label="Sin imagen" role="img" className="grid size-10 shrink-0 place-items-center rounded-lg border bg-slate-100 text-slate-400"><svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="m3 17 5-5 4 4 3-3 6 6" /></svg></span>}<div><p className="font-semibold text-slate-900">{product.name}</p><p className="mt-0.5 text-xs text-slate-500">{product.set_name ?? "Sin set"}</p></div></div></td><td className="px-4 py-3"><span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">{tcgLabels[product.tcg] ?? product.tcg}</span><p className="mt-2 text-xs text-slate-500">{product.product_type}</p></td><td className="px-4 py-3">{product.language}</td><td className="px-4 py-3 font-medium">{product.retail_price_cents == null ? "—" : formatEuro(product.retail_price_cents)}</td><td className="px-4 py-3">{riskLabels[product.reprint_risk] ?? product.reprint_risk}</td><td className="px-4 py-3">{product.demand_score ?? "—"}</td><td className="px-4 py-3">{product.long_term_score ?? "—"}</td><td className="px-4 py-3"><div className="flex justify-end gap-3"><Link href={`/products/${product.id}/edit`} className="text-xs font-semibold text-emerald-700 hover:text-emerald-900">Editar</Link><DeleteButton id={product.id} action={deleteProduct} entityName={product.name} /></div></td></tr>)}</tbody></table></div> : <EmptyState title={q || filters.tcg || filters.language ? "Sin resultados" : "No hay productos"} description={q || filters.tcg || filters.language ? "Prueba con otros filtros." : "Añade el primer producto a tu watchlist."} action={{ label: "Nuevo producto", href: "/products/new" }} />}
  </>;
}
