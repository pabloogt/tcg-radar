import { handlePokemillonCron } from "@/lib/cron/pokemillon-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return handlePokemillonCron(request);
}
