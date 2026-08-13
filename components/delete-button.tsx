"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import type { ActionState } from "@/lib/crud/action-state";
import { initialActionState } from "@/lib/crud/action-state";

type DeleteAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

function Submit() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="text-xs font-semibold text-red-600 hover:text-red-800 disabled:opacity-50">{pending ? "Eliminando…" : "Eliminar"}</button>;
}

export function DeleteButton({ id, action, entityName }: { id: string; action: DeleteAction; entityName: string }) {
  const [state, formAction] = useActionState(action, initialActionState);
  return <div className="text-right"><form action={formAction} onSubmit={(event) => { if (!window.confirm(`¿Eliminar ${entityName}? Esta acción no se puede deshacer.`)) event.preventDefault(); }}><input type="hidden" name="id" value={id} /><Submit /></form>{state.error ? <p role="alert" className="mt-1 max-w-48 text-xs text-red-600">{state.error}</p> : null}</div>;
}
