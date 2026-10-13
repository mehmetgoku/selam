import { haversineKm, travelMinutes } from "./geo";
import { checkVisit } from "./hours";
import type { Category, FoodType, Plan, ScoredPlace, Vibe } from "./types";

export type Pace = "rahat" | "normal" | "yogun";

export interface PlanPrefs {
  days: number;
  pace: Pace;
  interests: Category[]; // yemek her zaman dahil
  vibes: Vibe[]; // seçilenlerden en az birini taşıyanlar öne çıkar
  maxPrice: 1 | 2 | 3 | 4;
  /** ilk gezi günü (0 = Pazar); verilirse kapalı olan mekânlar plana alınmaz */
  startDow?: number | null;
}

export type SlotId = "kahvalti" | "sabah" | "ogle" | "ikindi" | "kahve" | "gunbatimi" | "aksam" | "gece";

interface Slot {
  id: SlotId;
  label: string;
  minStart: number; // dakika (günün başından)
  /** bu saatten sonra başlayacaksa dilim atlanır (ör. 7 saatlik tekne turundan sonra "öğle yemeği" 17:30'a kalmasın) */
  maxStart: number;
  match: (p: ScoredPlace, prefs: PlanPrefs) => boolean;
}

/** Bu süre ve üstü (tekne turu, Ihlara gibi) "tam gün" sayılır: yalnızca sabah diliminde başlayabilir. */
const FULL_DAY_MIN = 240;
/** Plan en geç 02:00'de biter (gece yarısından sonrası ertesi güne taşmasın). */
const DAY_END = 26 * 60;
const MAIN_MEAL: FoodType[] = ["kebap", "pide-lahmacun", "balik", "lokanta", "sokak"];
const isFood = (p: ScoredPlace, types: FoodType[]) => p.cat === "yemek" && !!p.food && types.includes(p.food);
const sights = (p: ScoredPlace) => p.cat === "kultur" || p.cat === "doga";

export const SLOTS: Record<SlotId, Slot> = {
  kahvalti: { id: "kahvalti", label: "Kahvaltı", minStart: 9 * 60, maxStart: 11 * 60, match: (p) => isFood(p, ["kahvalti"]) },
  sabah: {
    id: "sabah",
    label: "Sabah gezisi",
    minStart: 10 * 60 + 15,
    maxStart: 12 * 60,
    match: (p, f) => !p.when && (sights(p) || (p.cat === "eglence" && p.dur >= FULL_DAY_MIN)) && f.interests.includes(p.cat),
  },
  ogle: { id: "ogle", label: "Öğle yemeği", minStart: 12 * 60 + 30, maxStart: 15 * 60, match: (p) => isFood(p, [...MAIN_MEAL]) },
  ikindi: {
    id: "ikindi",
    label: "İkindi",
    minStart: 14 * 60 + 30,
    maxStart: 17 * 60 + 30,
    match: (p, f) =>
      !p.when && (sights(p) || p.cat === "eglence" || p.cat === "alisveris") && f.interests.includes(p.cat),
  },
  gunbatimi: {
    id: "gunbatimi",
    label: "Gün batımı",
    minStart: 17 * 60 + 30, // mevsime göre değişir; 17:30 kış sonu–yaz arası makul bir orta nokta
    maxStart: 20 * 60,
    match: (p, f) => p.when === "sunset" && f.interests.includes(p.cat),
  },
  kahve: { id: "kahve", label: "Kahve / tatlı molası", minStart: 16 * 60 + 30, maxStart: 18 * 60, match: (p) => isFood(p, ["kahve", "tatli"]) },
  aksam: {
    id: "aksam",
    label: "Akşam yemeği",
    minStart: 19 * 60,
    maxStart: 21 * 60 + 30,
    match: (p) => isFood(p, ["balik", "meyhane", "kebap", "lokanta"]),
  },
  gece: {
    id: "gece",
    label: "Gece",
    minStart: 21 * 60 + 15,
    maxStart: 23 * 60 + 30,
    match: (p, f) => (p.cat === "pub" && f.interests.includes("pub")) || (p.cat === "eglence" && !p.when && p.vibes.includes("gece") && f.interests.includes("eglence")),
  },
};

const TEMPLATES: Record<Pace, SlotId[]> = {
  rahat: ["kahvalti", "sabah", "ogle", "aksam"],
  normal: ["kahvalti", "sabah", "ogle", "ikindi", "gunbatimi", "aksam", "gece"],
  yogun: ["kahvalti", "sabah", "ogle", "ikindi", "kahve", "gunbatimi", "aksam", "gece"],
};

export interface TimedStop {
  place: ScoredPlace;
  slot?: string;
  start: number; // dk
  end: number;
  travelFromPrev: number; // dk
}

export function fmtTime(min: number) {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Bir günün duraklarına saat atar (seyahat süresi + ziyaret süresi; yemek/gece slotları için alt sınır). */
export function scheduleDay(stops: { place: ScoredPlace; slot?: string }[], startAt = 9 * 60): TimedStop[] {
  const out: TimedStop[] = [];
  let cursor = startAt;
  stops.forEach((s, i) => {
    const prev = out[i - 1]?.place;
    const travel = prev ? travelMinutes(haversineKm(prev, s.place)) : 0;
    const slot = s.slot ? SLOTS[s.slot as SlotId] : undefined;
    const minStart = slot?.minStart ?? 0;
    const start = Math.max(cursor + travel, minStart);
    const end = start + s.place.dur;
    out.push({ place: s.place, slot: slot?.label, start, end, travelFromPrev: travel });
    cursor = end;
  });
  return out;
}

/**
 * Otomatik plan: her gün için bir "çapa" (en yüksek puanlı, henüz kullanılmamış gezilecek yer) seçer;
 * slotları, puan yüksek + çapaya / bir önceki durağa yakın olacak şekilde doldurur.
 */
export function generatePlan(places: ScoredPlace[], prefs: PlanPrefs): Plan {
  const used = new Set<string>();
  const eligible = places.filter((p) => p.price <= prefs.maxPrice);
  const vibeBoost = (p: ScoredPlace) =>
    prefs.vibes.length && p.vibes.some((v) => prefs.vibes.includes(v)) ? 1.2 : 0;
  const days: Plan["days"] = [];

  for (let d = 0; d < prefs.days; d++) {
    const anchor = eligible
      .filter((p) => !used.has(p.id) && sights(p) && prefs.interests.includes(p.cat))
      .sort((a, b) => b.score + vibeBoost(b) - (a.score + vibeBoost(a)))[0];
    const center = anchor ?? eligible.find((p) => !used.has(p.id));
    const dow = prefs.startDow == null ? null : (prefs.startDow + d) % 7;
    const stops: { placeId: string; slot: SlotId }[] = [];
    let last = center;
    let cursor = 9 * 60;

    for (const slotId of TEMPLATES[prefs.pace]) {
      const slot = SLOTS[slotId];
      const pick = eligible
        .filter((p) => !used.has(p.id) && slot.match(p, prefs))
        .map((p) => {
          const toLast = last ? haversineKm(last, p) : 0;
          const toCenter = center ? haversineKm(center, p) : 0;
          const travel = stops.length ? travelMinutes(toLast) : 0; // scheduleDay ile aynı: ilk durakta yol yok
          const start = Math.max(cursor + travel, slot.minStart);
          return { p, start, v: p.score + vibeBoost(p) - 0.25 * toLast - 0.15 * toCenter };
        })
        .filter((c) => c.start <= slot.maxStart && c.start + c.p.dur <= DAY_END && (c.p.dur < FULL_DAY_MIN || slotId === "sabah"))
        .filter((c) => {
          if (dow == null) return true;
          const st = checkVisit(c.p.hours, dow, c.start, c.start + c.p.dur).state;
          return st !== "closed" && st !== "closing";
        })
        .sort((a, b) => b.v - a.v)[0];
      if (!pick) continue;
      cursor = pick.start + pick.p.dur;
      used.add(pick.p.id);
      stops.push({ placeId: pick.p.id, slot: slotId });
      last = pick.p;
    }
    days.push({ stops, dow: dow ?? undefined });
  }
  return { days };
}
