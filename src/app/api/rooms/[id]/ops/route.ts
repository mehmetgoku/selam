import { parseOp } from "@/lib/collab";
import { mutateRoom, roomCity } from "@/server/rooms";
import { cityContext, CID_RE, json, preflight, readJson, ROOM_RE } from "@/server/http";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/** Plana işlem uygula. Gövde: { cid, name, op } */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ROOM_RE.test(id)) return json(req, { error: "Oda bulunamadı" }, 404);
  const body = await readJson(req);
  const cid = typeof body?.cid === "string" ? body.cid : "";
  if (!body || !CID_RE.test(cid)) return json(req, { error: "Geçersiz istek" }, 400);
  const city = roomCity(id);
  const ctx = city && cityContext(city);
  if (!ctx) return json(req, { error: "Oda bulunamadı" }, 404);
  const op = parseOp(body.op, ctx.validIds);
  if (!op) return json(req, { error: "Geçersiz işlem" }, 400);
  const res = mutateRoom(id, { cid, name: typeof body.name === "string" ? body.name : "" }, op, ctx);
  return res.ok ? json(req, res.room) : json(req, { error: res.error }, res.status);
}
