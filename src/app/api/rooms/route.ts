import { emptyState, sanitizePlan } from "@/lib/collab";
import { createRoom } from "@/server/rooms";
import { cityContext, json, preflight, readJson } from "@/server/http";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/** Yeni oda aç. Gövde: { city: "istanbul", plan?: Plan } */
export async function POST(req: Request) {
  const body = await readJson(req);
  const city = typeof body?.city === "string" ? body.city : "";
  const ctx = cityContext(city);
  if (!body || !ctx) return json(req, { error: "Geçersiz istek" }, 400);
  const plan = body.plan ? sanitizePlan(body.plan, ctx.validIds) : null;
  const id = createRoom(city, plan ? { plan, votes: {} } : emptyState());
  if (!id) return json(req, { error: "Çok fazla oda açıldı, biraz sonra tekrar dene" }, 429);
  return json(req, { id }, 201);
}
