import { describe, expect, it } from "vitest";
import { loadAllCities, loadCity } from "./data";
import { generatePlan, scheduleDay, type PlanPrefs } from "./itinerary";
import { rankPlaces, scorePlace } from "./rank";
import type { Place } from "./types";

const base: Place = {
  id: "x", city: "t", name: "X", cat: "yemek", food: "kebap", district: "d", lat: 41, lng: 29,
  price: 2, vibes: [], why: ["a"], bestTime: "-", dur: 60, ed: 7,
};

describe("rank", () => {
  it("harici veri yokken editoryal puanı kullanır", () => {
    expect(scorePlace(base).score).toBe(7);
  });
  it("az yorumlu mükemmel puan, çok yorumlu iyi puanı geçemez", () => {
    const few = scorePlace({ ...base, google: { rating: 5, count: 3 } });
    const many = scorePlace({ ...base, google: { rating: 4.6, count: 5000 } });
    expect(many.score).toBeGreaterThan(few.score);
  });
  it("iki kaynak varsa localness hesaplar", () => {
    const s = scorePlace({ ...base, google: { rating: 4.5, count: 900 }, tripadvisor: { rating: 4.5, count: 100 } });
    expect(s.localness).toBeCloseTo(0.9);
  });
  it("puana göre sıralar", () => {
    const r = rankPlaces([{ ...base, id: "a", ed: 5 }, { ...base, id: "b", ed: 9 }]);
    expect(r[0].id).toBe("b");
  });
});

describe("seed veri", () => {
  it("tüm şehirlerde id benzersiz, koordinatlar şehre yakın, gerekçe dolu", () => {
    for (const c of loadAllCities()) {
      const ids = new Set(c.places.map((p) => p.id));
      expect(ids.size).toBe(c.places.length);
      for (const p of c.places) {
        expect(p.why.length).toBeGreaterThan(0);
        expect(p.cat === "yemek" ? !!p.food : !p.food).toBe(true);
        expect(p.ed).toBeGreaterThanOrEqual(0);
        expect(p.ed).toBeLessThanOrEqual(10);
      }
    }
  });
});

describe("itinerary", () => {
  const prefs: PlanPrefs = { days: 2, pace: "normal", interests: ["kultur", "doga", "eglence", "pub", "alisveris"], vibes: [], maxPrice: 4 };
  const ist = loadCity("istanbul")!;

  it("kopya mekân içermeyen, gün sayısı kadar gün üretir", () => {
    const plan = generatePlan(ist.places, prefs);
    expect(plan.days).toHaveLength(2);
    const ids = plan.days.flatMap((d) => d.stops.map((s) => s.placeId));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThan(6);
  });
  it("bütçe sınırına uyar", () => {
    const plan = generatePlan(ist.places, { ...prefs, maxPrice: 1 });
    const byId = new Map(ist.places.map((p) => [p.id, p]));
    for (const d of plan.days) for (const s of d.stops) expect(byId.get(s.placeId)!.price).toBe(1);
  });
  it("saatler artan sırada, öğle 12:30'dan önce başlamaz", () => {
    const plan = generatePlan(ist.places, prefs);
    const byId = new Map(ist.places.map((p) => [p.id, p]));
    const timed = scheduleDay(plan.days[0].stops.map((s) => ({ place: byId.get(s.placeId)!, slot: s.slot })));
    timed.forEach((t, i) => {
      if (i) expect(t.start).toBeGreaterThanOrEqual(timed[i - 1].end);
      if (t.slot === "Öğle yemeği") expect(t.start).toBeGreaterThanOrEqual(12 * 60 + 30);
    });
  });
});

describe("ingest eşleşmesi", () => {
  it("seed koordinatından uzak Google sonucunu reddeder, yakın olanı alır", async () => {
    process.env.GOOGLE_MAPS_API_KEY = "k";
    const { googleLookup } = await import("../../scripts/ingest");
    const mk = (lat: number) =>
      (async () =>
        new Response(
          JSON.stringify({ places: [{ id: "g1", rating: 4.5, userRatingCount: 100, location: { latitude: lat, longitude: 29 } }] }),
        )) as unknown as typeof fetch;
    expect(await googleLookup(base, "T", mk(45))).toBeNull();
    const ok = await googleLookup(base, "T", mk(41.001));
    expect(ok?.signal.rating).toBe(4.5);
  });
});
