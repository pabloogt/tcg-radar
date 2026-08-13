"use client";

import { useFormStatus } from "react-dom";

export function FormSubmit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60" type="submit">{pending ? "Guardando…" : label}</button>;
}
