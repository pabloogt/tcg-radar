import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const vitestPath = fileURLToPath(new URL("../node_modules/vitest/vitest.mjs", import.meta.url));
const result = spawnSync(process.execPath, [vitestPath, "run", "scripts/pokemillon-dry-run.live.test.ts", "--reporter=verbose"], {
  env: { ...process.env, POKEMILLON_LIVE_DRY_RUN: "1" },
  stdio: "inherit",
});
process.exit(result.status ?? 1);
