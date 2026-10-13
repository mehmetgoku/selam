import { NextResponse } from "next/server";
import { loadCity } from "@/lib/data";

export const CID_RE = /^[A-Za-z0-9_-]{8,32}$/;
export const ROOM_RE = /^[A-Za-z0-9_-]{12}$/;
const MAX_BODY = 16_000;

export const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** Gövdeyi boyut sınırıyla okuyup JSON'a çevirir; geçersizse null. */
export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  const text = await req.text();
  if (text.length > MAX_BODY) return null;
  try {
    const v = JSON.parse(text);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function cityContext(slug: string) {
  const city = loadCity(slug);
  if (!city) return null;
  const names = new Map(city.places.map((p) => [p.id, p.name]));
  return { validIds: new Set(names.keys()), nameOf: (id: string) => names.get(id) ?? id };
}
