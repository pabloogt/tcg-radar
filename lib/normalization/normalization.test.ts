import { describe, expect, it } from "vitest";
import { productIdentity } from "./identity";
import { normalizeIdentityText } from "./text";
import { normalizeDomain, normalizeListingUrl } from "./url";
const product = { tcg: "pokemon" as const, name: "Scarlet & Violet: ETB!", setName: " Base  Set ", productType: "Elite-Trainer Box", language: "es", imageUrl: null };
describe("normalization", () => {
  it("normalizes whitespace, case, accents and punctuation", () => expect(normalizeIdentityText("  Élite--BOX! ")).toBe("elite box"));
  it("creates deterministic product identity", () => expect(productIdentity(product)).toBe(productIdentity({ ...product, name: "scarlet and violet etb" })));
  it("keeps languages separate", () => expect(productIdentity(product)).not.toBe(productIdentity({ ...product, language: "en" })));
  it("normalizes store domains", () => expect(normalizeDomain("HTTP://WWW.Example.COM/shop/" )).toBe("example.com"));
  it("normalizes equivalent listing URLs", () => expect(normalizeListingUrl("https://www.Example.com/item/?utm_source=x&b=2&a=1")).toBe(normalizeListingUrl("http://example.com/item?a=1&b=2")));
});
