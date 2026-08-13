import Link from "next/link";

import { deleteListing } from "@/app/(dashboard)/listings/actions";
import { DeleteButton } from "@/components/delete-button";
import { ListingStatus } from "@/components/listings/listing-status";
import { ProductThumbnail } from "@/components/product-thumbnail";
import { formatEuro, formatEuropeanDateTime } from "@/lib/formatters";
import type { Tables } from "@/lib/supabase/database.types";

export type ListingView = Tables<"listings"> & {
  product: Pick<Tables<"products">, "id" | "name" | "image_url" | "tcg">;
  store: Pick<Tables<"stores">, "id" | "name">;
};

const tcgLabels: Record<string, string> = {
  pokemon: "Pokémon",
  one_piece: "One Piece",
  lorcana: "Lorcana",
};

export function ListingTable({ listings, compact = false }: { listings: ListingView[]; compact?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-white">
      <table className={`w-full text-left text-sm ${compact ? "min-w-[760px]" : "min-w-[1120px]"}`}>
        <thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Producto</th><th className="px-4 py-3">Tienda</th><th className="px-4 py-3">Precio</th><th className="px-4 py-3">Envío</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Stock</th>{!compact ? <><th className="px-4 py-3">País / Vendedor</th><th className="px-4 py-3">Comprobado</th></> : null}<th className="px-4 py-3 text-right">Acciones</th></tr></thead>
        <tbody className="divide-y">{listings.map((listing) => <tr key={listing.id} className="align-top">
          <td className="px-4 py-3"><Link href={`/products/${listing.product.id}`} className="flex items-center gap-3 hover:text-emerald-700"><ProductThumbnail imageUrl={listing.product.image_url} name={listing.product.name} /><span><span className="block font-semibold">{listing.product.name}</span><span className="mt-0.5 block text-xs text-slate-500">{tcgLabels[listing.product.tcg] ?? listing.product.tcg}</span></span></Link></td>
          <td className="px-4 py-3"><Link href={`/stores/${listing.store.id}`} className="font-medium hover:text-emerald-700">{listing.store.name}</Link></td>
          <td className="px-4 py-3">{formatEuro(listing.price_cents)}</td><td className="px-4 py-3">{listing.shipping_known ? formatEuro(listing.shipping_cents) : <span className="text-amber-700">Desconocido</span>}</td><td className="px-4 py-3 font-semibold">{listing.shipping_known ? formatEuro(listing.price_cents + listing.shipping_cents) : <span className="text-amber-700">Incompleto</span>}</td>
          <td className="px-4 py-3"><ListingStatus status={listing.stock_status} />{listing.available_quantity != null ? <p className="mt-1 text-xs text-slate-500">{listing.available_quantity} uds.</p> : null}</td>
          {!compact ? <><td className="px-4 py-3"><p>{listing.country}</p><p className="text-xs text-slate-500">{listing.seller ?? "Sin vendedor"}</p></td><td className="px-4 py-3 text-xs text-slate-600">{formatEuropeanDateTime(listing.checked_at)}</td></> : null}
          <td className="px-4 py-3"><div className="flex justify-end gap-3"><a href={listing.url} target="_blank" rel="noreferrer" className="text-xs font-semibold text-slate-600 hover:text-slate-900">Abrir</a><Link href={`/calculator?listing=${listing.id}`} className="text-xs font-semibold text-amber-700 hover:text-amber-900">Calcular</Link><Link href={`/listings/${listing.id}/edit`} className="text-xs font-semibold text-emerald-700 hover:text-emerald-900">Editar</Link><DeleteButton id={listing.id} action={deleteListing} entityName={`el listing de ${listing.product.name}`} /></div></td>
        </tr>)}</tbody>
      </table>
    </div>
  );
}
