"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import { runCardImport, runCardPriceImport, type CardImportSummary } from "@/lib/cards/import";
import { SupabaseCardImportRepository } from "@/lib/cards/supabase-repository";
import { loadProductInvestmentAnalyses } from "@/lib/investment/product-data";
import { persistProductInvestmentSnapshot } from "@/lib/investment/product-snapshots";
import { persistEffectiveSetSnapshot } from "@/lib/investment/set-snapshots";

export type CardImportActionState = { error: string | null; summary: CardImportSummary | null; mode: "preview" | "import" | null };

const requestSchema = z.object({ setId: z.uuid(), kind: z.enum(["cards", "prices"]), format: z.enum(["csv", "json"]), mode: z.enum(["preview", "import"]) });

export async function importCardData(_state: CardImportActionState, formData: FormData): Promise<CardImportActionState> {
  const request = requestSchema.safeParse({ setId: formData.get("set_id"), kind: formData.get("kind"), format: formData.get("format"), mode: formData.get("mode") });
  if (!request.success) return { error: "Selecciona colección, formato y modo válidos.", summary: null, mode: null };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > 5_000_000) return { error: "Selecciona un archivo de hasta 5 MB.", summary: null, mode: request.data.mode };
  const { supabase, user } = await requireUser();
  const { data: set } = await supabase.from("tcg_sets").select("id,tcg").eq("id", request.data.setId).eq("user_id", user.id).maybeSingle();
  if (!set) return { error: "La colección no existe o no te pertenece.", summary: null, mode: request.data.mode };
  const repository = new SupabaseCardImportRepository(supabase, user.id); const content = await file.text(); const dryRun = request.data.mode === "preview";
  try {
    const summary = request.data.kind === "cards" ? await runCardImport({ content, format: request.data.format, setId: set.id, tcg: set.tcg, dryRun, repository }) : await runCardPriceImport({ content, format: request.data.format, setId: set.id, dryRun, repository });
    if (!dryRun && (summary.cardsCreated > 0 || summary.cardsMatched > 0 || summary.pricesCreated > 0)) {
      await persistEffectiveSetSnapshot(supabase, user.id, set.id);
      const analyses = await loadProductInvestmentAnalyses(supabase, user.id, { setIds: [set.id], limit: 250 });
      for (const analysis of analyses) await persistProductInvestmentSnapshot(supabase, user.id, analysis);
      revalidatePath(`/investment/sets/${set.id}`); revalidatePath("/investment"); revalidatePath("/investment/cards"); revalidatePath("/dashboard");
    }
    revalidatePath("/investment/data");
    return { error: null, summary, mode: request.data.mode };
  } catch { return { error: "No se pudo procesar el archivo. No se han expuesto detalles internos.", summary: null, mode: request.data.mode }; }
}
