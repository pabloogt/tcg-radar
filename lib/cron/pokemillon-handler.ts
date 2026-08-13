import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getCronSecret, getScheduledEnvironment } from "./env";
import type { ScheduledMonitorSummary } from "./scheduled-pokemillon";

type HandlerDependencies = {
  getCronSecret: () => string;
  getOwnerUserId: () => string;
  run: (ownerUserId: string) => Promise<{ statusCode: number; body: ScheduledMonitorSummary }>;
};

function secretsEqual(provided: string, expected: string): boolean {
  const providedHash = createHash("sha256").update(provided).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(providedHash, expectedHash);
}

function bearerToken(header: string | null): string | null {
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7);
  return token.length > 0 ? token : null;
}

async function defaultRun(ownerUserId: string) {
  const { runConfiguredScheduledPokemillon } = await import("./scheduled-pokemillon");
  return runConfiguredScheduledPokemillon(ownerUserId);
}

const defaultDependencies: HandlerDependencies = {
  getCronSecret,
  getOwnerUserId: () => getScheduledEnvironment().TCG_RADAR_OWNER_USER_ID,
  run: defaultRun,
};

export async function handlePokemillonCron(request: Request, dependencies: HandlerDependencies = defaultDependencies): Promise<Response> {
  let expectedSecret: string;
  try { expectedSecret = dependencies.getCronSecret(); } catch { return NextResponse.json({ ok: false, error: "Scheduled monitor is not configured." }, { status: 503 }); }
  const providedSecret = bearerToken(request.headers.get("authorization"));
  if (!providedSecret || !secretsEqual(providedSecret, expectedSecret)) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  let ownerUserId: string;
  try { ownerUserId = dependencies.getOwnerUserId(); } catch { return NextResponse.json({ ok: false, error: "Scheduled monitor is not configured." }, { status: 503 }); }
  try {
    const result = await dependencies.run(ownerUserId);
    return NextResponse.json(result.body, { status: result.statusCode });
  } catch {
    return NextResponse.json({ ok: false, source: "pokemillon", status: "failed", error: "Scheduled monitor execution failed." }, { status: 502 });
  }
}
