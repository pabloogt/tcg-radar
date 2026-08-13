import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function findClientComponents(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return findClientComponents(path);
    if (!entry.isFile() || !entry.name.endsWith(".tsx")) return [];
    const contents = readFileSync(path, "utf8");
    return contents.startsWith('"use client"') || contents.startsWith("'use client'") ? [path] : [];
  });
}

describe("admin Supabase boundary", () => {
  it("is marked server-only and is not imported by client components", () => {
    expect(readFileSync(join(process.cwd(), "lib/supabase/admin.ts"), "utf8")).toContain('import "server-only"');
    const clientFiles = [
      ...findClientComponents(join(process.cwd(), "app")),
      ...findClientComponents(join(process.cwd(), "components")),
    ];
    expect(clientFiles.length).toBeGreaterThan(0);
    for (const file of clientFiles) expect(readFileSync(file, "utf8")).not.toContain("@/lib/supabase/admin");
  });
});
