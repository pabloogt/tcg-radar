"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import { dealThresholdsSchema } from "@/lib/market/deal";

export type DealSettingsActionResult = { ok: boolean; message: string };

function percentToBasisPoints(value: string): number {
  const normalized = value.trim().replace(/\s|%/g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : Number.NaN;
}

const inputSchema = z.object({
  goodPrice: z.string(), opportunity: z.string(), bargain: z.string(), expensive: z.string(),
  alertBargains: z.boolean(), alertOpportunities: z.boolean(), alertGoodPrices: z.boolean(),
});

export async function saveDealSettingsAction(input: z.infer<typeof inputSchema>): Promise<DealSettingsActionResult> {
  const raw = inputSchema.safeParse(input);
  if (!raw.success) return { ok: false, message: "Revisa los valores introducidos." };
  const thresholds = dealThresholdsSchema.safeParse({ goodPriceBps: percentToBasisPoints(raw.data.goodPrice), opportunityBps: percentToBasisPoints(raw.data.opportunity), bargainBps: percentToBasisPoints(raw.data.bargain), expensiveBps: percentToBasisPoints(raw.data.expensive) });
  if (!thresholds.success) return { ok: false, message: "Los umbrales deben ser válidos y cumplir: buen precio < oportunidad < chollo." };
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("deal_settings").upsert({ user_id: user.id, good_price_bps: thresholds.data.goodPriceBps, opportunity_bps: thresholds.data.opportunityBps, bargain_bps: thresholds.data.bargainBps, expensive_bps: thresholds.data.expensiveBps, alert_bargains: raw.data.alertBargains, alert_opportunities: raw.data.alertOpportunities, alert_good_prices: raw.data.alertGoodPrices }, { onConflict: "user_id" });
  if (error) return { ok: false, message: "No se pudo guardar la clasificación de precios." };
  revalidatePath("/settings/pricing"); revalidatePath("/dashboard");
  return { ok: true, message: "Clasificación de precios guardada." };
}
