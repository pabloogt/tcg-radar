import "server-only";

import { z } from "zod";

const optionalBotToken = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().trim().regex(/^\d+:[A-Za-z0-9_-]+$/, "Invalid TELEGRAM_BOT_TOKEN format").optional(),
);
const optionalChatId = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().trim().regex(/^-?\d+$/, "Invalid TELEGRAM_CHAT_ID format").optional(),
);

const telegramEnvironmentSchema = z.object({
  TELEGRAM_BOT_TOKEN: optionalBotToken,
  TELEGRAM_CHAT_ID: optionalChatId,
});

export type TelegramConfiguration =
  | { configured: true; botToken: string; chatId: string }
  | { configured: false; botConfigured: boolean; chatConfigured: boolean; missing: Array<"TELEGRAM_BOT_TOKEN" | "TELEGRAM_CHAT_ID"> };

export function getTelegramConfiguration(): TelegramConfiguration {
  const parsed = telegramEnvironmentSchema.safeParse({
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID,
  });
  if (!parsed.success) throw new Error("Invalid server-only Telegram environment configuration.");
  const botConfigured = Boolean(parsed.data.TELEGRAM_BOT_TOKEN);
  const chatConfigured = Boolean(parsed.data.TELEGRAM_CHAT_ID);
  if (parsed.data.TELEGRAM_BOT_TOKEN && parsed.data.TELEGRAM_CHAT_ID) {
    return { configured: true, botToken: parsed.data.TELEGRAM_BOT_TOKEN, chatId: parsed.data.TELEGRAM_CHAT_ID };
  }
  const missing: Array<"TELEGRAM_BOT_TOKEN" | "TELEGRAM_CHAT_ID"> = [];
  if (!botConfigured) missing.push("TELEGRAM_BOT_TOKEN");
  if (!chatConfigured) missing.push("TELEGRAM_CHAT_ID");
  return { configured: false, botConfigured, chatConfigured, missing };
}

export function requireTelegramConfiguration(): Extract<TelegramConfiguration, { configured: true }> {
  const configuration = getTelegramConfiguration();
  if (!configuration.configured) throw new Error(`Missing Telegram server configuration: ${configuration.missing.join(", ")}`);
  return configuration;
}

export function getTelegramBotToken(): string | null {
  const parsed = telegramEnvironmentSchema.safeParse({ TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID });
  if (!parsed.success) throw new Error("Invalid server-only Telegram environment configuration.");
  return parsed.data.TELEGRAM_BOT_TOKEN ?? null;
}
