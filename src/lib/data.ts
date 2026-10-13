import fs from "node:fs";
import path from "node:path";
import { rankPlaces } from "./rank";
import type { City, Place, ScoredPlace, SourceSignal } from "./types";

const ROOT = process.cwd();
const CITY_DIR = path.join(ROOT, "data", "cities");
const SIGNAL_DIR = path.join(ROOT, "data", "signals");

type RawSignals = Record<string, { google?: { id?: unknown }; tripadvisor?: SourceSignal } & Record<string, unknown>>;

/**
 * Sinyal dosyasından yalnızca izin verilenleri alır: Google Place ID + TripAdvisor.
 * Eski/elle düzenlenmiş dosyalarda Google puanı, saati, koordinatı olsa bile BİRLEŞTİRİLMEZ (lisans güvencesi).
 */
export function mergeSignals(p: Place, raw?: RawSignals[string]): Place {
  if (!raw) return p;
  const gid = raw.google?.id;
  const ta = raw.tripadvisor;
  const okTa = ta && typeof ta.rating === "number" && typeof ta.count === "number" ? ta : undefined;
  return {
    ...p,
    ...(typeof gid === "string" && /^[A-Za-z0-9_-]{10,200}$/.test(gid) ? { google: { id: gid } } : {}),
    ...(okTa ? { tripadvisor: okTa } : {}),
  };
}

function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

export function listCitySlugs() {
  return fs
    .readdirSync(CITY_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""));
}

/** Seed (editoryal) veri + varsa `npm run ingest` ile çekilen Google/TripAdvisor sinyalleri */
export function loadCity(slug: string): (Omit<City, "places"> & { places: ScoredPlace[] }) | null {
  const city = readJson<City>(path.join(CITY_DIR, `${slug}.json`));
  if (!city) return null;
  const signals = readJson<RawSignals>(path.join(SIGNAL_DIR, `${slug}.json`)) ?? {};
  const places: Place[] = city.places.map((p) => mergeSignals({ ...p, city: slug }, signals[p.id]));
  return { ...city, places: rankPlaces(places) };
}

export const loadAllCities = () =>
  listCitySlugs()
    .map(loadCity)
    .filter((c): c is NonNullable<typeof c> => !!c);
