import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AlertCandidate } from "@/lib/alerts/evaluate-alerts";
import { requireTelegramConfiguration } from "@/lib/env.server";
import type { Database } from "@/lib/supabase/database.types";
import { sendTelegramMessage, type TelegramSendResult } from "@/lib/telegram/client";
import { formatTelegramAlert } from "@/lib/telegram/format";

const MAX_DELIVERY_ATTEMPTS = 3;
const STALE_CLAIM_MILLISECONDS = 5 * 60 * 1_000;

export type AlertClaim = { status: "claimed"; alertId: string } | { status: "duplicate" };
export type AlertDeliveryOutcome = { status: "sent" | "duplicate" | "failed"; candidate: AlertCandidate };
export type AlertDeliverySummary = { sent: number; duplicates: number; failed: number };

export interface AlertDeliveryRepository {
  claim(candidate: AlertCandidate): Promise<AlertClaim>;
  markDelivered(alertId: string, deliveredAt: string): Promise<void>;
  markFailed(alertId: string, safeError: string): Promise<void>;
}

export class SupabaseAlertDeliveryRepository implements AlertDeliveryRepository {
  constructor(private readonly client: SupabaseClient<Database>, private readonly userId: string) {}

  async claim(candidate: AlertCandidate): Promise<AlertClaim> {
    const now = new Date().toISOString();
    const inserted = await this.client.from("alerts").insert({
      user_id: this.userId,
      listing_id: candidate.listingId,
      alert_type: candidate.alertType,
      price_cents: candidate.newPriceCents,
      dedupe_key: candidate.dedupeKey,
      delivered: false,
      delivered_at: null,
      error_message: null,
      delivery_status: "sending",
      delivery_attempts: 1,
      last_attempt_at: now,
    }).select("id").single();
    if (!inserted.error) return { status: "claimed", alertId: inserted.data.id };
    if (inserted.error.code !== "23505") throw inserted.error;

    const existing = await this.client.from("alerts")
      .select("id, delivered, delivery_status, delivery_attempts, last_attempt_at")
      .eq("user_id", this.userId)
      .eq("dedupe_key", candidate.dedupeKey)
      .maybeSingle();
    if (existing.error) throw existing.error;
    const row = existing.data;
    if (!row || row.delivered || row.delivery_attempts >= MAX_DELIVERY_ATTEMPTS) return { status: "duplicate" };
    const staleSending = row.delivery_status === "sending" && row.last_attempt_at !== null && Date.now() - new Date(row.last_attempt_at).getTime() >= STALE_CLAIM_MILLISECONDS;
    if (row.delivery_status !== "failed" && !staleSending) return { status: "duplicate" };

    const retried = await this.client.from("alerts").update({
      delivery_status: "sending",
      delivery_attempts: row.delivery_attempts + 1,
      last_attempt_at: now,
      error_message: null,
    }).eq("id", row.id)
      .eq("user_id", this.userId)
      .eq("delivery_status", row.delivery_status)
      .eq("delivery_attempts", row.delivery_attempts)
      .select("id")
      .maybeSingle();
    if (retried.error) throw retried.error;
    return retried.data ? { status: "claimed", alertId: retried.data.id } : { status: "duplicate" };
  }

  async markDelivered(alertId: string, deliveredAt: string): Promise<void> {
    const { error } = await this.client.from("alerts").update({ delivered: true, delivered_at: deliveredAt, delivery_status: "delivered", error_message: null }).eq("id", alertId).eq("user_id", this.userId);
    if (error) throw error;
  }

  async markFailed(alertId: string, safeError: string): Promise<void> {
    const { error } = await this.client.from("alerts").update({ delivered: false, delivered_at: null, delivery_status: "failed", error_message: safeError.slice(0, 500) }).eq("id", alertId).eq("user_id", this.userId);
    if (error) throw error;
  }
}

export async function deliverAlertCandidate(repository: AlertDeliveryRepository, candidate: AlertCandidate, send: (message: string) => Promise<TelegramSendResult> = async (message) => sendTelegramMessage(requireTelegramConfiguration(), message)): Promise<AlertDeliveryOutcome> {
  const claim = await repository.claim(candidate);
  if (claim.status === "duplicate") return { status: "duplicate", candidate };
  let delivery: TelegramSendResult;
  try {
    delivery = await send(formatTelegramAlert(candidate));
  } catch {
    delivery = { ok: false, error: "No se pudo completar la entrega de Telegram." };
  }
  if (delivery.ok) {
    await repository.markDelivered(claim.alertId, new Date().toISOString());
    return { status: "sent", candidate };
  }
  await repository.markFailed(claim.alertId, delivery.error);
  return { status: "failed", candidate };
}

export async function deliverAlertCandidates(repository: AlertDeliveryRepository, candidates: AlertCandidate[], send?: (message: string) => Promise<TelegramSendResult>): Promise<{ outcomes: AlertDeliveryOutcome[]; summary: AlertDeliverySummary }> {
  const outcomes: AlertDeliveryOutcome[] = [];
  for (const candidate of candidates) {
    try {
      outcomes.push(await deliverAlertCandidate(repository, candidate, send));
    } catch {
      outcomes.push({ status: "failed", candidate });
    }
  }
  return {
    outcomes,
    summary: {
      sent: outcomes.filter((outcome) => outcome.status === "sent").length,
      duplicates: outcomes.filter((outcome) => outcome.status === "duplicate").length,
      failed: outcomes.filter((outcome) => outcome.status === "failed").length,
    },
  };
}
