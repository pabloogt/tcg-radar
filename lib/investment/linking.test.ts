import { describe, expect, it } from "vitest";
import { normalizedSetKey, resolveProductSet } from "./linking";

const sets = [{ id: "pokemon", tcg: "pokemon", name: "Mascarada Crepuscular", normalizedKey: normalizedSetKey("Mascarada Crepuscular") }, { id: "one-piece", tcg: "one_piece", name: "Mascarada Crepuscular", normalizedKey: normalizedSetKey("Mascarada Crepuscular") }];
describe("deterministic set linking", () => {
  it("links exact normalized names", () => expect(resolveProductSet({ tcg: "pokemon", setName: "  MASCARADA—CREPUSCULAR " }, sets)?.id).toBe("pokemon"));
  it("never links another TCG", () => expect(resolveProductSet({ tcg: "lorcana", setName: "Mascarada Crepuscular" }, sets)).toBeNull());
  it("leaves uncertain translated names unlinked without aliases", () => expect(resolveProductSet({ tcg: "pokemon", setName: "Twilight Masquerade" }, sets)).toBeNull());
});
