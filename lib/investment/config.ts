export const investmentMetricKeys = ["chaseStrength", "chaseDepth", "cardValue", "pullRateAttractiveness", "characterStrength", "collectorAppeal", "demand", "hype", "scarcity", "reprintSafety", "priceMomentum", "setMaturity"] as const;
export type InvestmentMetricKey = (typeof investmentMetricKeys)[number];
export type InvestmentHorizon = "short" | "medium" | "long";

export const investmentWeights: Record<InvestmentHorizon, Record<InvestmentMetricKey, number>> = {
  short: { hype: 18, demand: 18, scarcity: 15, priceMomentum: 15, chaseStrength: 10, chaseDepth: 5, cardValue: 5, reprintSafety: 6, collectorAppeal: 3, characterStrength: 2, pullRateAttractiveness: 2, setMaturity: 1 },
  medium: { chaseStrength: 14, chaseDepth: 12, cardValue: 10, collectorAppeal: 10, characterStrength: 9, demand: 12, scarcity: 10, reprintSafety: 10, pullRateAttractiveness: 5, hype: 3, priceMomentum: 3, setMaturity: 2 },
  long: { chaseStrength: 14, chaseDepth: 14, collectorAppeal: 14, characterStrength: 12, cardValue: 10, reprintSafety: 10, scarcity: 8, pullRateAttractiveness: 6, demand: 5, setMaturity: 4, hype: 1, priceMomentum: 2 },
};

export const investmentMetricLabels: Record<InvestmentMetricKey, string> = {
  chaseStrength: "Fuerza de chase cards", chaseDepth: "Profundidad de cartas deseables", cardValue: "Valor del ecosistema de cartas", pullRateAttractiveness: "Atractivo de pull rates", characterStrength: "Fuerza de personajes", collectorAppeal: "Atractivo coleccionista", demand: "Demanda", hype: "Hype actual", scarcity: "Escasez", reprintSafety: "Seguridad ante reimpresiones", priceMomentum: "Momentum de precio", setMaturity: "Madurez de la colección",
};
