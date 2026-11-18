import { describe, expect, it } from "vitest";
import { searchProducts, type SearchableProduct } from "./products";

const products: SearchableProduct[] = [
  { id: "etb-es", name: "ETB Chaos Rising | Caos Creciente", setName: "Caos Creciente", productType: "elite_trainer_box", tcg: "pokemon", language: "es" },
  { id: "etb-en", name: "ETB Chaos Rising", setName: "Chaos Rising", productType: "elite_trainer_box", tcg: "pokemon", language: "en" },
  { id: "box-es", name: "Booster Box Caos Creciente", setName: "Caos Creciente", productType: "booster_box", tcg: "pokemon", language: "es" },
  { id: "op", name: "Booster Box OP-12", setName: "Legacy of the Master", productType: "booster_box", tcg: "one_piece", language: "en" },
];

describe("global product search", () => {
  it("searches product names with punctuation and case tolerance", () => {
    expect(searchProducts(products, "  etb: CHAOS rising ").map((result) => result.product.id)).toEqual(["etb-en", "etb-es"]);
  });

  it("searches set names case-insensitively", () => {
    expect(new Set(searchProducts(products, "CAOS CRECIENTE").map((result) => result.product.id))).toEqual(new Set(["etb-es", "box-es"]));
  });

  it("keeps language variants as separate results", () => {
    expect(searchProducts(products, "ETB").map((result) => result.product.id)).toEqual(["etb-en", "etb-es"]);
  });

  it("keeps product types separate and can search metadata", () => {
    expect(searchProducts(products, "pokemon booster box").map((result) => result.product.id)).toEqual(["box-es"]);
    expect(searchProducts(products, "one piece").map((result) => result.product.id)).toEqual(["op"]);
  });
});
