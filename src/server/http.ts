import { NextResponse } from "next/server";
import { loadCity } from "@/lib/data";

export const CID_RE = /^[A-Za-z0-9_-]{8,32}$/;
export const ROOM_RE = /^[A-Za-z0-9_-]{12}$/;
const MAX_BODY = 16_000;

/**
 * CORS: mobil uygulama (Capacitor WebView) farklı bir kökenden (capacitor://localhost, https://localhost) çağırır.
 * Yalnızca bu izinli kökenlere yanıt başlığı verilir; `CORS_ORIGINS` (virgülle ayrılmış) ile değiştirilebilir.
 * Güvenlik modeli zaten "bağlantı = yetki" olduğundan çerez/kimlik bilgisi kullanılmaz (credentials yok).
 */
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS ?? "capacitor://localhost,https://localhost,http://localhost")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) return { Vary: "Origin" };
  return {
    Vary: "Origin",
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

export const json = (req: Request, body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...corsHeaders(req) } });

/** OPTIONS ön kontrolü */
export const preflight = (req: Request) => new NextResponse(null, { status: 204, headers: corsHeaders(req) });

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
