import { describe, expect, it } from "vitest";
import pokemonPage from "./__fixtures__/pokemon-page.json";
import onePiecePage from "./__fixtures__/one-piece-page.json";
import { productIdentity } from "@/lib/normalization/identity";
import { parsePokemillonCollectionPage, parseShopifyMoney } from "./parser";

const observedAt = "2026-08-13T10:00:00.000Z";
const pokemonCollection = { handle: "cajas-elite-de-entrenador", tcg: "pokemon" as const, label: "Pokémon" };
const onePieceCollection = { handle: "caja-one-piece", tcg: "one_piece" as const, label: "One Piece" };

function productWithTitle(title: string, id: number) {
  return {
    ...pokemonPage.products[1],
    id,
    title,
    handle: `fixture-${id}`,
    tags: ["Pokemon"],
    variants: [{ ...pokemonPage.products[1].variants[0], id: id * 10, available: true, price: "99.90", compare_at_price: null }],
  };
}

describe("Pokemillon product parser", () => {
  const pokemon = parsePokemillonCollectionPage(pokemonPage, pokemonCollection, observedAt);
  const onePiece = parsePokemillonCollectionPage(onePiecePage, onePieceCollection, observedAt);

  it("normalizes a Pokemon sealed product and one observation per language variant", () => {
    const variants = pokemon.observations.filter((item) => item.product.name.includes("Elite"));
    expect(variants).toHaveLength(2);
    expect(variants.map((item) => item.product.language)).toEqual(["es", "en"]);
    expect(variants[0].product.productType).toBe("elite_trainer_box");
  });

  it("normalizes a One Piece booster box", () => {
    const observation = onePiece.observations.find((item) => item.sourceProductId === "2101");
    expect(observation?.product.tcg).toBe("one_piece");
    expect(observation?.product.productType).toBe("booster_box");
    expect(observation?.product.setName).toBe("OP-12");
  });

  it("uses the sale price and preserves compare-at price", () => {
    const observation = pokemon.observations.find((item) => item.sourceProductId === "1101");
    expect(observation?.listing.priceCents).toBe(4990);
    expect(observation?.listing.compareAtPriceCents).toBe(5999);
  });

  it("ignores compare-at values that do not represent an original higher price", () => {
    const product = { ...pokemonPage.products[1], variants: [{ ...pokemonPage.products[1].variants[0], compare_at_price: "0.00" }] };
    const observation = parsePokemillonCollectionPage({ products: [product] }, pokemonCollection, observedAt).observations[0];
    expect(observation?.listing.compareAtPriceCents).toBeNull();
  });

  it("prefers explicit product TCG metadata over the collection hint", () => {
    const parsed = parsePokemillonCollectionPage(onePiecePage, pokemonCollection, observedAt);
    expect(parsed.observations.every((item) => item.product.tcg === "one_piece")).toBe(true);
  });

  it("maps unavailable products to out of stock", () => {
    expect(onePiece.observations.find((item) => item.sourceProductId === "2101")?.listing.stockStatus).toBe("out_of_stock");
  });

  it("maps explicit reservations to preorder", () => {
    expect(onePiece.observations.find((item) => item.sourceProductId === "2201")?.listing.stockStatus).toBe("preorder");
  });

  it("extracts image, source id and canonical variant URL", () => {
    const observation = pokemon.observations.find((item) => item.sourceProductId === "1101");
    expect(observation?.product.imageUrl).toBe("https://cdn.shopify.com/pokemon-es.jpg");
    expect(observation?.listing.url).toBe("https://www.pokemillon.com/products/caja-elite-entrenador-destinos-brillantes?variant=1101");
  });

  it("recognizes explicit Spanish and English", () => {
    expect(pokemon.observations.map((item) => item.product.language)).toContain("es");
    expect(onePiece.observations.find((item) => item.sourceProductId === "2101")?.product.language).toBe("en");
  });

  it("uses unknown only for an unambiguous single variant", () => {
    const raw = { products: [{ ...pokemonPage.products[1], title: "Caja Colección Charizard ex" }] };
    expect(parsePokemillonCollectionPage(raw, pokemonCollection, observedAt).observations[0]?.product.language).toBe("unknown");
  });

  it("skips Desde-style products whose multiple variants are not languages", () => {
    expect(pokemon.skipped.some((item) => item.sourceUrl.endsWith("/products/booster-box-especial") && item.reason === "ambiguous_variant")).toBe(true);
  });

  it.each([
    ["carta-suelta-pikachu", "individual card"],
    ["mystery-box-pokemon", "mystery box"],
    ["fundas-pokemon-premium", "accessory"],
  ])("skips irrelevant %s (%s)", (handle) => {
    expect(pokemon.skipped.some((item) => item.sourceUrl.endsWith(`/products/${handle}`) && item.reason === "irrelevant")).toBe(true);
  });

  it("isolates malformed prices", () => {
    expect(pokemon.skipped.some((item) => item.reason === "malformed_price")).toBe(true);
    expect(pokemon.observations.length).toBeGreaterThan(0);
  });

  it("marks Pokemillon shipping as unknown, not free", () => {
    expect(pokemon.observations[0]?.listing).toMatchObject({ shippingCents: null, shippingKnown: false });
  });

  it("keeps an individual ETB separate from a 10-ETB sealed case", () => {
    const result = parsePokemillonCollectionPage({ products: [
      productWithTitle("ETB Chaos Rising | Caos Creciente (Español)", 3001),
      productWithTitle("Case 10 ETB Chaos Rising | Caos Creciente (Español)", 3002),
    ] }, pokemonCollection, observedAt);
    const individual = result.observations.find((item) => item.sourceProductId === "30010");
    const sealedCase = result.observations.find((item) => item.sourceProductId === "30020");
    expect(individual?.product.productType).toBe("elite_trainer_box");
    expect(sealedCase?.product.productType).toBe("sealed_case_10_etb");
    expect(productIdentity(individual!.product)).not.toBe(productIdentity(sealedCase!.product));
  });

  it("classifies a six-ETB carton with quantity in its identity", () => {
    const result = parsePokemillonCollectionPage({ products: [productWithTitle("Caja 6 ETB Perfect Order (Español)", 3003)] }, pokemonCollection, observedAt);
    expect(result.observations[0]?.product.productType).toBe("sealed_case_6_etb");
    expect(productIdentity(result.observations[0]!.product)).toContain("sealed case 6 etb");
  });

  it.each([
    ["Caja 36 Sobres Destinos Brillantes (Español)", 3004],
    ["Caja 30 Sobres Pokémon Japonés", 3005],
  ])("keeps an ordinary booster box as booster_box: %s", (title, id) => {
    const result = parsePokemillonCollectionPage({ products: [productWithTitle(title, id)] }, pokemonCollection, observedAt);
    expect(result.observations[0]?.product.productType).toBe("booster_box");
  });

  it("skips ambiguous case wording instead of treating it as an individual product", () => {
    const result = parsePokemillonCollectionPage({ products: [productWithTitle("Case ETB Chaos Rising (Español)", 3006)] }, pokemonCollection, observedAt);
    expect(result.observations).toHaveLength(0);
    expect(result.skipped[0]?.reason).toBe("ambiguous_product_type");
  });

  it("parses European and Shopify money without floating-point arithmetic", () => {
    expect(parseShopifyMoney("49,90")).toBe(4990);
    expect(parseShopifyMoney("129.99")).toBe(12999);
    expect(parseShopifyMoney("12.999")).toBeNull();
  });

  it("isolates an invalid product shape", () => {
    const result = parsePokemillonCollectionPage({ products: [{ title: "Sin identificador" }, pokemonPage.products[0]] }, pokemonCollection, observedAt);
    expect(result.errors).toHaveLength(1);
    expect(result.observations).toHaveLength(2);
  });
});
