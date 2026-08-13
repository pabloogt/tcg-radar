"use client";

import { useState, useTransition } from "react";
import { discoverTelegramChatsAction, sendTestTelegramAction, type TelegramActionResult } from "@/app/(dashboard)/settings/notifications/actions";

export function TelegramSettings({ botConfigured, chatConfigured }: { botConfigured: boolean; chatConfigured: boolean }) {
  const [state, setState] = useState<TelegramActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const run = (action: () => Promise<TelegramActionResult>) => startTransition(async () => setState(await action()));
  return <section className="rounded-xl border bg-white p-5 shadow-sm shadow-slate-900/5">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="font-semibold text-slate-950">Telegram</h2><p className="mt-1 text-sm text-slate-600">Entrega server-side mediante Telegram Bot API.</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${botConfigured && chatConfigured ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{botConfigured && chatConfigured ? "Configurado" : "Incompleto"}</span></div>
    <dl className="mt-5 grid gap-2 sm:grid-cols-2"><div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs text-slate-500">Bot configurado</dt><dd className="mt-1 font-semibold">{botConfigured ? "Sí" : "No"}</dd></div><div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs text-slate-500">Chat ID configurado</dt><dd className="mt-1 font-semibold">{chatConfigured ? "Sí" : "No"}</dd></div></dl>
    {!chatConfigured ? <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm leading-6 text-sky-900"><p>1. Abre tu bot en Telegram y envíale un mensaje.</p><p>2. Pulsa “Buscar chats recientes”.</p><p>3. Copia el ID mostrado a <code>TELEGRAM_CHAT_ID</code> y reinicia la aplicación.</p></div> : null}
    <div className="mt-5 flex flex-wrap gap-2"><button type="button" disabled={pending || !botConfigured || !chatConfigured} onClick={() => run(sendTestTelegramAction)} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{pending ? "Procesando…" : "Enviar prueba"}</button>{!chatConfigured ? <button type="button" disabled={pending || !botConfigured} onClick={() => run(discoverTelegramChatsAction)} className="rounded-lg border px-3 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">Buscar chats recientes</button> : null}</div>
    {state ? <div role="status" className={`mt-4 rounded-lg border p-3 text-sm ${state.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"}`}><p>{state.message}</p>{state.chats?.length ? <ul className="mt-2 space-y-1">{state.chats.map((chat) => <li key={chat.id}><strong>{chat.label}</strong> · {chat.type} · Chat ID: <code>{chat.id}</code></li>)}</ul> : null}</div> : null}
    <p className="mt-4 text-xs text-slate-500">El token nunca se envía al navegador ni se muestra en esta página.</p>
  </section>;
}
