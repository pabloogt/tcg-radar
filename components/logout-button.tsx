"use client";

import { useFormStatus } from "react-dom";

import { logout } from "@/app/(dashboard)/actions";

function LogoutSubmit() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 disabled:opacity-60">
      <svg aria-hidden="true" className="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75"><path d="M10 17l5-5-5-5M15 12H3M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5" /></svg>
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}

export function LogoutButton() {
  return <form action={logout}><LogoutSubmit /></form>;
}
