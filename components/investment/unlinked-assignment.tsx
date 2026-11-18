"use client";

import { useActionState } from "react";
import { assignProductSet } from "@/app/(dashboard)/investment/actions";
import { initialActionState } from "@/lib/crud/action-state";

export function UnlinkedAssignment({ productId, sets }: { productId: string; sets: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(assignProductSet, initialActionState);
  return <form action={action} className="flex min-w-64 items-start gap-2"><input type="hidden" name="product_id" value={productId} /><select name="set_id" required className="h-9 min-w-0 flex-1 rounded-lg border px-2 text-sm"><option value="">Selecciona colección</option>{sets.map((set) => <option key={set.id} value={set.id}>{set.name}</option>)}</select><button disabled={pending} className="h-9 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white disabled:opacity-50">Vincular</button>{state.error ? <span className="text-xs text-red-600">{state.error}</span> : null}</form>;
}
