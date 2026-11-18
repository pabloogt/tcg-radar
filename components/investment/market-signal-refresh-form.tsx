"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { initialActionState, type ActionState } from "@/lib/crud/action-state";

type RefreshAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

function Submit() { const { pending } = useFormStatus(); return <button disabled={pending} className="rounded-lg border bg-white px-3 py-2 text-sm font-semibold text-emerald-700 disabled:opacity-50">{pending ? "Recalculando…" : "Recalcular señales internas"}</button>; }

export function MarketSignalRefreshForm({ action, setId }: { action: RefreshAction; setId: string }) {
  const [state, formAction] = useActionState(action, initialActionState);
  return <form action={formAction} className="text-right"><input type="hidden" name="set_id" value={setId} /><Submit />{state.error ? <p role="alert" className="mt-1 text-xs text-red-600">{state.error}</p> : null}</form>;
}
