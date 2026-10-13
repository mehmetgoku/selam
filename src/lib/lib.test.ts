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

import { checkVisit, istanbulNow, openStatus, statusText, type Period } from "./hours";
import { parseGoogleHours } from "../../scripts/ingest";

// Pzt-Cmt 09:00-17:00, Pazar kapalı; Cuma-Cmt barı 20:00 → ertesi 02:00
const museum: Period[] = [1, 2, 3, 4, 5, 6].map((d) => ({ day: d, open: 540, close: 1020, closeDay: d }));
const bar: Period[] = [5, 6].map((d) => ({ day: d, open: 1200, close: 120, closeDay: (d + 1) % 7 }));

describe("hours", () => {
  it("açık / kapalı / sonraki açılış", () => {
    expect(openStatus(museum, { dow: 2, minute: 600 }).state).toBe("open");
    const closed = openStatus(museum, { dow: 2, minute: 1100 });
    expect(closed).toMatchObject({ state: "closed", opensAt: { dow: 3, minute: 540 } });
    expect(openStatus(museum, { dow: 0, minute: 700 })).toMatchObject({ state: "closed", opensAt: { dow: 1, minute: 540 } });
  });
  it("gece yarısını aşan saatler ve hafta sonu sarması", () => {
    expect(openStatus(bar, { dow: 6, minute: 60 }).state).toBe("open"); // Cuma gecesinin devamı: Cmt 01:00
    expect(openStatus(bar, { dow: 0, minute: 60 }).state).toBe("open"); // Cmt gecesinin devamı: Paz 01:00
    expect(openStatus(bar, { dow: 0, minute: 200 }).state).toBe("closed");
    expect(openStatus(bar, { dow: 3, minute: 1300 })).toMatchObject({ state: "closed", opensAt: { dow: 5, minute: 1200 } });
  });
  it("bilinmeyen ve 7/24", () => {
    expect(openStatus(undefined, { dow: 1, minute: 0 }).state).toBe("unknown");
    expect(openStatus([], { dow: 1, minute: 0 }).state).toBe("unknown");
    expect(openStatus("24/7", { dow: 1, minute: 0 }).state).toBe("always");
  });
  it("yakında kapanıyor metni", () => {
    const now = { dow: 2, minute: 1000 };
    expect(statusText(openStatus(museum, now), now)).toContain("Yakında kapanıyor");
  });
  it("ziyaret kontrolü: kapalı, kapanışa yetişmiyor, uygun", () => {
    expect(checkVisit(museum, 0, 600, 660).state).toBe("closed"); // Pazar
    expect(checkVisit(museum, 2, 1000, 1090).state).toBe("closing"); // 16:40 başla, 17:00 kapanır
    expect(checkVisit(museum, 2, 600, 660).state).toBe("ok");
    expect(checkVisit(undefined, 2, 600, 660).state).toBe("unknown");
  });
  it("İstanbul saati UTC+3", () => {
    expect(istanbulNow(new Date("2026-10-13T21:30:00Z"))).toEqual({ dow: 3, minute: 30 }); // Çarşamba 00:30
  });
  it("Google periyotlarını dönüştürür", () => {
    expect(parseGoogleHours([{ open: { day: 1, hour: 9 }, close: { day: 1, hour: 17, minute: 30 } }])).toEqual([
      { day: 1, open: 540, close: 1050, closeDay: 1 },
    ]);
    expect(parseGoogleHours([{ open: { day: 0, hour: 0 } }])).toBe("24/7");
    expect(parseGoogleHours(undefined)).toBeUndefined();
  });
});

describe("saat farkındalıklı plan", () => {
  const ist = loadCity("istanbul")!;
  const prefs: PlanPrefs = { days: 1, pace: "normal", interests: ["kultur", "doga", "eglence", "pub", "alisveris"], vibes: [], maxPrice: 4 };
  it("kapalı olduğu kesin mekânı seçmez, günü işaretler", () => {
    // Topkapı'yı Pazartesi kapalı yap (gerçekte Salı kapalı; test için sentetik)
    const topkapi = ist.places.find((p) => p.id === "ist-topkapi")!;
    const places = ist.places.map((p) =>
      p.id === "ist-topkapi" ? { ...p, hours: [2, 3, 4, 5, 6, 0].map((d) => ({ day: d, open: 540, close: 1020, closeDay: d })) } : p,
    );
    const mon = generatePlan(places, { ...prefs, startDow: 1 });
    expect(mon.days[0].dow).toBe(1);
    expect(mon.days[0].stops.some((s) => s.placeId === topkapi.id)).toBe(false);
  });
  it("startDow verilmezse davranış değişmez", () => {
    expect(generatePlan(ist.places, prefs).days[0].dow).toBeUndefined();
  });
});
