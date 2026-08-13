import { describe, expect, it, vi } from "vitest";
import { getSafeTelegramChats, sendTelegramMessage } from "./client";

const configuration = { configured: true as const, botToken: "test-token", chatId: "123" };

describe("Telegram HTTP client", () => {
  it("sends through the Bot API without exposing configuration in the payload", async () => { const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ ok: true, result: {} }), { status: 200 })); const result = await sendTelegramMessage(configuration, "Mensaje", fetchMock); expect(result).toEqual({ ok: true }); const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as Record<string, unknown>; expect(body).toEqual({ chat_id: "123", text: "Mensaje", disable_web_page_preview: true }); expect(JSON.stringify(body)).not.toContain("test-token"); });
  it("returns a safe failure without Telegram response details", async () => { const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ ok: false, description: "secret detail" }), { status: 401 })); const result = await sendTelegramMessage(configuration, "Mensaje", fetchMock); expect(result).toEqual({ ok: false, error: "Telegram rechazó el mensaje (HTTP 401)." }); });
  it("returns only safe chat identification data from getUpdates", async () => { const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ ok: true, result: [{ update_id: 1, message: { chat: { id: -123, type: "group", title: "Radar" }, text: "private message" } }] }), { status: 200 })); const result = await getSafeTelegramChats("test-token", fetchMock); expect(result).toEqual({ ok: true, chats: [{ id: "-123", type: "group", label: "Radar" }] }); });
});
