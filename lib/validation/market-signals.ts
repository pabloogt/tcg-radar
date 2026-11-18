import { z } from "zod";

const blankToNull = (value: unknown) => value === undefined || value === null || typeof value === "string" && value.trim() === "" ? null : value;

export const editableMarketSignalTypes = ["manual_demand", "manual_hype", "manual_reprint_risk", "reprint_event", "official_reprint_announced", "official_restock_announced", "set_out_of_print", "production_window_closed", "unknown_supply_status"] as const;

export const marketSignalFormSchema = z.object({
  set_id: z.uuid(),
  signal_type: z.enum(editableMarketSignalTypes),
  source_type: z.enum(["manual", "official"]),
  source_key: z.preprocess(blankToNull, z.string().trim().min(1).max(120).nullable()),
  value: z.coerce.number().int().min(0, "Introduce un valor entre 0 y 100.").max(100, "Introduce un valor entre 0 y 100."),
  confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
  observed_at: z.iso.datetime(),
  sample_size: z.preprocess(blankToNull, z.coerce.number().int().min(0).max(10_000_000).nullable()),
  note: z.preprocess(blankToNull, z.string().trim().max(1_000).nullable()),
  reprint_status: z.preprocess(blankToNull, z.enum(["LOW_RISK", "MODERATE_RISK", "HIGH_RISK", "CONFIRMED_REPRINT", "UNKNOWN"]).nullable()),
  confirmed_reprint: z.boolean(),
  announcement_date: z.preprocess(blankToNull, z.iso.date().nullable()),
  expected_supply_date: z.preprocess(blankToNull, z.iso.date().nullable()),
}).superRefine((value, context) => {
  const reprintSignal = value.signal_type !== "manual_demand" && value.signal_type !== "manual_hype";
  if ((value.signal_type === "manual_demand" || value.signal_type === "manual_hype" || value.signal_type === "manual_reprint_risk") && value.source_type !== "manual") context.addIssue({ code: "custom", path: ["source_type"], message: "Esta señal debe tener procedencia manual." });
  if (value.signal_type.startsWith("official_") && value.source_type !== "official") context.addIssue({ code: "custom", path: ["source_type"], message: "Un anuncio oficial debe usar procedencia oficial." });
  if (value.signal_type === "official_reprint_announced" && !value.confirmed_reprint) context.addIssue({ code: "custom", path: ["confirmed_reprint"], message: "Un anuncio oficial de reimpresión debe marcarse como confirmado." });
  if (value.confirmed_reprint && value.signal_type !== "official_reprint_announced" && value.signal_type !== "manual_reprint_risk") context.addIssue({ code: "custom", path: ["confirmed_reprint"], message: "Solo una señal explícita puede confirmar una reimpresión." });
  if (value.confirmed_reprint && value.reprint_status !== null && value.reprint_status !== "CONFIRMED_REPRINT") context.addIssue({ code: "custom", path: ["reprint_status"], message: "Una reimpresión confirmada debe usar el estado confirmado." });
  if (value.reprint_status === "CONFIRMED_REPRINT" && !value.confirmed_reprint) context.addIssue({ code: "custom", path: ["reprint_status"], message: "Marca también la confirmación explícita." });
  if (value.reprint_status === "LOW_RISK" && value.value >= 40 || value.reprint_status === "MODERATE_RISK" && (value.value < 40 || value.value >= 70) || value.reprint_status === "HIGH_RISK" && value.value < 70) context.addIssue({ code: "custom", path: ["reprint_status"], message: "El estado no coincide con el valor de riesgo." });
  if (!reprintSignal && (value.reprint_status !== null || value.confirmed_reprint || value.announcement_date !== null || value.expected_supply_date !== null)) context.addIssue({ code: "custom", path: ["reprint_status"], message: "Los datos de reimpresión solo corresponden a señales de suministro." });
});
