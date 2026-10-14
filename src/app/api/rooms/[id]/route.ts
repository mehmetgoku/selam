import { getRoom } from "@/server/rooms";
import { CID_RE, json, preflight, ROOM_RE } from "@/server/http";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/** Odanın durumu + kimlerin çevrimiçi olduğu. ?cid=&name=&since=<sürüm> */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ROOM_RE.test(id)) return json(req, { error: "Oda bulunamadı" }, 404);
  const q = new URL(req.url).searchParams;
  const cid = q.get("cid") ?? "";
  const since = q.has("since") ? Number(q.get("since")) : undefined;
  const room = getRoom(id, CID_RE.test(cid) ? { cid, name: q.get("name") ?? "" } : undefined, Number.isInteger(since) ? since : undefined);
  return room ? json(req, room) : json(req, { error: "Oda bulunamadı" }, 404);
}
