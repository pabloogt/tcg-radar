import Link from "next/link";

import { deleteStore } from "@/app/(dashboard)/stores/actions";
import { DeleteButton } from "@/components/delete-button";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth/require-user";

type Props = { searchParams: Promise<{ q?: string; status?: string }> };

export default async function StoresPage({ searchParams }: Props) {
  const filters = await searchParams;
  const q = filters.q?.trim() ?? "";
  const { supabase, user } = await requireUser();
  let query = supabase.from("stores").select("*").eq("user_id", user.id).order("name");
  if (q) query = query.ilike("name", `%${q}%`);
  if (filters.status === "active") query = query.eq("active", true);
  if (filters.status === "inactive") query = query.eq("active", false);
  const { data: stores, error } = await query;

  return <><div className="flex items-start justify-between gap-4"><PageHeader title="Stores" description="Keep the retailers and marketplaces you monitor in one place." /><Link href="/stores/new" className="shrink-0 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Nueva tienda</Link></div>
    <form className="mb-4 grid gap-3 rounded-xl border bg-white p-3 sm:grid-cols-[1fr_180px_auto]"><input name="q" defaultValue={q} placeholder="Buscar por nombre" className="h-9 rounded-lg border px-3 text-sm" /><select name="status" defaultValue={filters.status ?? ""} className="h-9 rounded-lg border px-2 text-sm"><option value="">Todas</option><option value="active">Activas</option><option value="inactive">Inactivas</option></select><button className="rounded-lg border px-3 text-sm font-semibold hover:bg-slate-50">Filtrar</button></form>
    {error ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">No se pudieron cargar las tiendas.</p> : stores?.length ? <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full min-w-[720px] text-left text-sm"><thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Tienda</th><th className="px-4 py-3">País</th><th className="px-4 py-3">Web</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3 text-right">Acciones</th></tr></thead><tbody className="divide-y">{stores.map((store) => <tr key={store.id}><td className="px-4 py-3"><p className="font-semibold text-slate-900">{store.name}</p>{store.shipping_notes ? <p className="mt-0.5 max-w-sm truncate text-xs text-slate-500">{store.shipping_notes}</p> : null}</td><td className="px-4 py-3">{store.country}</td><td className="px-4 py-3">{store.website_url ? <a href={store.website_url} target="_blank" rel="noreferrer" className="text-emerald-700 hover:underline">Visitar web</a> : "—"}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${store.active ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{store.active ? "Activa" : "Inactiva"}</span></td><td className="px-4 py-3"><div className="flex justify-end gap-3"><Link href={`/stores/${store.id}/edit`} className="text-xs font-semibold text-emerald-700 hover:text-emerald-900">Editar</Link><DeleteButton id={store.id} action={deleteStore} entityName={store.name} /></div></td></tr>)}</tbody></table></div> : <EmptyState title={q || filters.status ? "Sin resultados" : "No hay tiendas"} description={q || filters.status ? "Prueba con otros filtros." : "Añade la primera tienda que quieras monitorizar."} action={{ label: "Nueva tienda", href: "/stores/new" }} />}
  </>;
}
