import { SLOTS, type SlotId } from "./itinerary";
import type { Plan } from "./types";

/**
 * Planı URL'ye gömer (sunucusuz paylaşım). Biçim: gün~gün, gün = "<dow|->.<durak,durak>", durak = "<id>[@slot]"
 * Örn: "2.ist-van@kahvalti,ist-ayasofya@sabah~-.ist-moda"
 * Gelen veri güvenilmezdir: bilinmeyen mekân/slot atılır, boyutlar sınırlanır.
 */
const MAX_DAYS = 14;
const MAX_STOPS = 40;
const ID_RE = /^[a-z0-9-]{1,40}$/;

export function encodePlan(plan: Plan): string {
  return plan.days
    .map((d) => `${d.dow ?? "-"}.${d.stops.map((s) => (s.slot ? `${s.placeId}@${s.slot}` : s.placeId)).join(",")}`)
    .join("~");
}

export function decodePlan(raw: string, validIds: Set<string>): Plan | null {
  if (!raw || raw.length > 4000) return null;
  const parts = raw.split("~");
  if (parts.length > MAX_DAYS) return null;
  const seen = new Set<string>();
  const days: Plan["days"] = [];
  for (const part of parts) {
    const dot = part.indexOf(".");
    if (dot < 1) return null;
    const dowRaw = part.slice(0, dot);
    const dow = dowRaw === "-" ? undefined : Number(dowRaw);
    if (dow !== undefined && !(Number.isInteger(dow) && dow >= 0 && dow <= 6)) return null;
    const stops: Plan["days"][number]["stops"] = [];
    for (const tok of part.slice(dot + 1).split(",").filter(Boolean).slice(0, MAX_STOPS)) {
      const [id, slot] = tok.split("@");
      if (!ID_RE.test(id) || !validIds.has(id) || seen.has(id)) continue;
      seen.add(id);
      stops.push(slot && slot in SLOTS ? { placeId: id, slot: slot as SlotId } : { placeId: id });
    }
    days.push(dow === undefined ? { stops } : { stops, dow });
  }
  return days.some((d) => d.stops.length) ? { days } : null;
}

export function shareText(
  cityName: string,
  days: { label: string; lines: string[] }[],
  url: string,
): string {
  return [
    `📍 ${cityName} gezi planım (Selam)`,
    ...days.flatMap((d) => ["", `*${d.label}*`, ...d.lines]),
    ...(url ? ["", `Planı aç: ${url}`] : []),
  ].join("\n");
}
