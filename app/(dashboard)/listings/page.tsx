import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { ListingTable, type ListingView } from "@/components/listings/listing-table";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth/require-user";

type Props = { searchParams: Promise<{ product?: string; store?: string; tcg?: string; stock?: string; country?: string; sort?: string }> };
export default async function ListingsPage({ searchParams }: Props) {
  const filters = await searchParams; const { supabase, user } = await requireUser();
  const [{ data: listingRows, error }, { data: products }, { data: stores }] = await Promise.all([
    supabase.from("listings").select("*").eq("user_id", user.id),
    supabase.from("products").select("id, name, image_url, tcg").eq("user_id", user.id).order("name"),
    supabase.from("stores").select("id, name").eq("user_id", user.id).order("name"),
  ]);
  const productMap = new Map((products ?? []).map((item) => [item.id, item])); const storeMap = new Map((stores ?? []).map((item) => [item.id, item]));
  let listings: ListingView[] = (listingRows ?? []).flatMap((item) => { const product = productMap.get(item.product_id); const store = storeMap.get(item.store_id); return product && store ? [{ ...item, product, store }] : []; });
  if (filters.product) listings = listings.filter((item) => item.product_id === filters.product);
  if (filters.store) listings = listings.filter((item) => item.store_id === filters.store);
  if (filters.tcg) listings = listings.filter((item) => item.product.tcg === filters.tcg);
  if (filters.stock) listings = listings.filter((item) => item.stock_status === filters.stock);
  const countryFilter = filters.country?.toUpperCase();
  if (countryFilter) listings = listings.filter((item) => item.country === countryFilter);
  listings.sort((a, b) => filters.sort === "price" ? a.price_cents - b.price_cents : filters.sort === "total" ? (a.shipping_known ? a.price_cents + a.shipping_cents : Number.POSITIVE_INFINITY) - (b.shipping_known ? b.price_cents + b.shipping_cents : Number.POSITIVE_INFINITY) : new Date(b.checked_at).getTime() - new Date(a.checked_at).getTime());
  const countries = [...new Set((listingRows ?? []).map((item) => item.country))].sort();
  const filtered = Boolean(filters.product || filters.store || filters.tcg || filters.stock || filters.country);
  return <><div className="flex items-start justify-between gap-4"><PageHeader title="Listings" description="Compara precios, envío y stock entre productos y tiendas." /><Link href="/listings/new" className="shrink-0 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Nuevo listing</Link></div>
    <form className="mb-4 grid gap-2 rounded-xl border bg-white p-3 sm:grid-cols-3 xl:grid-cols-7"><select name="product" defaultValue={filters.product ?? ""} className="h-9 rounded-lg border px-2 text-sm"><option value="">Todos los productos</option>{products?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select name="store" defaultValue={filters.store ?? ""} className="h-9 rounded-lg border px-2 text-sm"><option value="">Todas las tiendas</option>{stores?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select name="tcg" defaultValue={filters.tcg ?? ""} className="h-9 rounded-lg border px-2 text-sm"><option value="">Todos los TCG</option><option value="pokemon">Pokémon</option><option value="one_piece">One Piece</option><option value="lorcana">Lorcana</option></select><select name="stock" defaultValue={filters.stock ?? ""} className="h-9 rounded-lg border px-2 text-sm"><option value="">Todo el stock</option><option value="in_stock">En stock</option><option value="out_of_stock">Agotado</option><option value="preorder">Preventa</option><option value="unknown">Desconocido</option></select><select name="country" defaultValue={filters.country ?? ""} className="h-9 rounded-lg border px-2 text-sm"><option value="">Todos los países</option>{countries.map((country) => <option key={country}>{country}</option>)}</select><select name="sort" defaultValue={filters.sort ?? "checked"} className="h-9 rounded-lg border px-2 text-sm"><option value="checked">Más reciente</option><option value="price">Menor precio</option><option value="total">Menor total</option></select><button className="rounded-lg border px-3 text-sm font-semibold hover:bg-slate-50">Aplicar</button></form>
    {error ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">No se pudieron cargar los listings.</p> : listings.length ? <ListingTable listings={listings} /> : <EmptyState title={filtered ? "Sin resultados" : "No hay listings"} description={filtered ? "Prueba con otros filtros." : "Relaciona un producto con una tienda creando el primer listing."} action={{ label: "Nuevo listing", href: "/listings/new" }} />}</>;
}
