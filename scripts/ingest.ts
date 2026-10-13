/**
 * Mekânları Google Places (yalnızca Place ID) ve TripAdvisor Content API (puan/yorum) ile eşler.
 * Resmi API'ler kullanılır (scraping yok). Çıktı: data/signals/<şehir>.json
 *
 *   GOOGLE_MAPS_API_KEY=... TRIPADVISOR_API_KEY=... npm run ingest [-- istanbul izmir]
 *
 * LİSANS: Google'dan yalnızca Place ID saklanır; puan/yorum/saat/koordinat DİSKE YAZILMAZ (canlı çekilir, bkz. src/lib/live.ts).
 * Eşleşme, seed koordinatına 1.5 km'den yakın sonuçlarla sınırlıdır; sapma >300 m ise seed'i düzeltmeniz için uyarı basılır.
 */
import fs from "node:fs";
import path from "node:path";
import { haversineKm } from "../src/lib/geo";
import type { City, GoogleRef, Place, SourceSignal } from "../src/lib/types";

const ROOT = path.join(import.meta.dirname, "..");
const MAX_KM = 1.5;
const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY;
const TA_KEY = process.env.TRIPADVISOR_API_KEY;

type Out = Record<string, { google?: GoogleRef; tripadvisor?: SourceSignal }>;

export async function googleLookup(p: Place, cityName: string, fetchFn = fetch) {
  const res = await fetchFn("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_KEY!,
      "X-Goog-FieldMask": "places.id,places.location",
    },
    body: JSON.stringify({
      textQuery: `${p.name} ${p.district} ${cityName}`,
      languageCode: "tr",
      regionCode: "TR",
      locationBias: { circle: { center: { latitude: p.lat, longitude: p.lng }, radius: 2000 } },
      maxResultCount: 3,
    }),
  });
  if (!res.ok) throw new Error(`Google ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { places?: any[] };
  const hit = data.places?.find(
    (g) => g.location && haversineKm(p, { lat: g.location.latitude, lng: g.location.longitude }) <= MAX_KM,
  );
  if (!hit) return null;
  const driftKm = haversineKm(p, { lat: hit.location.latitude, lng: hit.location.longitude });
  return { ref: { id: hit.id as string } satisfies GoogleRef, driftKm };
}

export async function tripadvisorLookup(p: Place, cityName: string, fetchFn = fetch) {
  const q = new URLSearchParams({
    key: TA_KEY!,
    searchQuery: `${p.name} ${cityName}`,
    latLong: `${p.lat},${p.lng}`,
    radius: "2",
    radiusUnit: "km",
    language: "tr",
  });
  const s = await fetchFn(`https://api.content.tripadvisor.com/api/v1/location/search?${q}`, {
    headers: { accept: "application/json" },
  });
  if (!s.ok) throw new Error(`TripAdvisor search ${s.status}`);
  const id = ((await s.json()) as { data?: { location_id: string }[] }).data?.[0]?.location_id;
  if (!id) return null;
  const d = await fetchFn(`https://api.content.tripadvisor.com/api/v1/location/${id}/details?key=${TA_KEY}&language=tr`, {
    headers: { accept: "application/json" },
  });
  if (!d.ok) throw new Error(`TripAdvisor details ${d.status}`);
  const det = (await d.json()) as { rating?: string; num_reviews?: string; web_url?: string };
  if (!det.rating) return null;
  return {
    rating: Number(det.rating),
    count: Number(det.num_reviews ?? 0),
    id,
    url: det.web_url,
    fetchedAt: new Date().toISOString(),
  } satisfies SourceSignal;
}

async function main() {
  if (!GOOGLE_KEY && !TA_KEY) {
    console.error("GOOGLE_MAPS_API_KEY ve/veya TRIPADVISOR_API_KEY gerekli.");
    process.exit(1);
  }
  const cityDir = path.join(ROOT, "data", "cities");
  const outDir = path.join(ROOT, "data", "signals");
  fs.mkdirSync(outDir, { recursive: true });
  const wanted = process.argv.slice(2);
  const slugs = fs.readdirSync(cityDir).map((f) => f.replace(".json", "")).filter((s) => !wanted.length || wanted.includes(s));

  for (const slug of slugs) {
    const city = JSON.parse(fs.readFileSync(path.join(cityDir, `${slug}.json`), "utf8")) as City;
    const outFile = path.join(outDir, `${slug}.json`);
    const out: Out = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile, "utf8")) : {};
    for (const place of city.places) {
      const entry: Out[string] = out[place.id] ?? {};
      try {
        if (GOOGLE_KEY) {
          const g = await googleLookup(place, city.name);
          if (g) {
            entry.google = g.ref; // yalnızca Place ID
            if (g.driftKm > 0.3) console.warn(`  ! ${place.name}: seed koordinatı Google'dan ${Math.round(g.driftKm * 1000)} m farklı — data/cities/${slug}.json'ı kontrol edin`);
          }
        }
        if (TA_KEY) {
          const t = await tripadvisorLookup(place, city.name);
          if (t) entry.tripadvisor = t;
        }
        out[place.id] = entry;
        console.log(`✓ ${slug}/${place.name}`, entry.google?.id ? "placeId✓" : "-", entry.tripadvisor?.rating ?? "-");
      } catch (e) {
        console.warn(`✗ ${slug}/${place.name}: ${(e as Error).message}`);
      }
      await new Promise((r) => setTimeout(r, 150)); // nazik hız sınırı
    }
    fs.writeFileSync(outFile, JSON.stringify(out, null, 2));
  }
}

if (process.argv[1]?.endsWith("ingest.ts")) main();
