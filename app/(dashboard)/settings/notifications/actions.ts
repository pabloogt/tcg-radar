"use server";

import { requireUser } from "@/lib/auth/require-user";
import { getTelegramBotToken, requireTelegramConfiguration } from "@/lib/env.server";
import { getSafeTelegramChats, sendTelegramMessage, type SafeTelegramChat } from "@/lib/telegram/client";

export type TelegramActionResult = { ok: boolean; message: string; chats?: SafeTelegramChat[] };

export async function sendTestTelegramAction(): Promise<TelegramActionResult> {
  await requireUser();
  try {
    const result = await sendTelegramMessage(requireTelegramConfiguration(), "TCG Radar conectado correctamente.");
    return result.ok ? { ok: true, message: "Mensaje de prueba enviado correctamente." } : { ok: false, message: result.error };
  } catch {
    return { ok: false, message: "Falta TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID en la configuración del servidor." };
  }
}

export async function discoverTelegramChatsAction(): Promise<TelegramActionResult> {
  await requireUser();
  const botToken = getTelegramBotToken();
  if (!botToken) return { ok: false, message: "Configura TELEGRAM_BOT_TOKEN antes de buscar chats." };
  const result = await getSafeTelegramChats(botToken);
  if (!result.ok) return { ok: false, message: result.error };
  return { ok: true, message: result.chats.length ? "Chats recientes encontrados." : "No hay chats recientes. Envía primero un mensaje al bot y vuelve a intentarlo.", chats: result.chats };
}
