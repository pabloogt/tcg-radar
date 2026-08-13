import "server-only";

import { z } from "zod";
import type { TelegramConfiguration } from "@/lib/env.server";

const apiResponseSchema = z.object({ ok: z.boolean() }).passthrough();
const updatesResponseSchema = z.object({
  ok: z.boolean(),
  result: z.array(z.object({
    message: z.object({
      chat: z.object({
        id: z.union([z.number(), z.string()]),
        type: z.string(),
        title: z.string().optional(),
        username: z.string().optional(),
        first_name: z.string().optional(),
      }).passthrough(),
    }).optional(),
  }).passthrough()).optional(),
}).passthrough();

export type SafeTelegramChat = { id: string; type: string; label: string };
export type TelegramSendResult = { ok: true } | { ok: false; error: string };

function endpoint(botToken: string, method: "sendMessage" | "getUpdates"): string {
  return `https://api.telegram.org/bot${botToken}/${method}`;
}

async function telegramFetch(url: string, init: RequestInit, fetchImplementation: typeof fetch): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    return await fetchImplementation(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timeout);
  }
}

export async function sendTelegramMessage(configuration: Extract<TelegramConfiguration, { configured: true }>, text: string, fetchImplementation: typeof fetch = fetch): Promise<TelegramSendResult> {
  try {
    const response = await telegramFetch(endpoint(configuration.botToken, "sendMessage"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: configuration.chatId, text, disable_web_page_preview: true }),
    }, fetchImplementation);
    const body = apiResponseSchema.safeParse(await response.json());
    if (!response.ok || !body.success || !body.data.ok) return { ok: false, error: `Telegram rechazó el mensaje (HTTP ${response.status}).` };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error && error.name === "AbortError" ? "Telegram no respondió dentro del tiempo límite." : "No se pudo conectar con Telegram." };
  }
}

export async function getSafeTelegramChats(botToken: string, fetchImplementation: typeof fetch = fetch): Promise<{ ok: true; chats: SafeTelegramChat[] } | { ok: false; error: string }> {
  try {
    const response = await telegramFetch(endpoint(botToken, "getUpdates"), { method: "GET" }, fetchImplementation);
    const parsed = updatesResponseSchema.safeParse(await response.json());
    if (!response.ok || !parsed.success || !parsed.data.ok) return { ok: false, error: `Telegram no pudo obtener las actualizaciones (HTTP ${response.status}).` };
    const chats = new Map<string, SafeTelegramChat>();
    for (const update of parsed.data.result ?? []) {
      const chat = update.message?.chat;
      if (!chat) continue;
      const label = chat.title ?? chat.username ?? chat.first_name ?? "Chat sin nombre";
      chats.set(String(chat.id), { id: String(chat.id), type: chat.type, label });
    }
    return { ok: true, chats: [...chats.values()] };
  } catch (error) {
    return { ok: false, error: error instanceof Error && error.name === "AbortError" ? "Telegram no respondió dentro del tiempo límite." : "No se pudo conectar con Telegram." };
  }
}
