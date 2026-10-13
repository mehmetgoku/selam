import { describe, expect, it } from "vitest";
import { loadAllCities, loadCity, mergeSignals } from "./data";
import { haversineKm } from "./geo";
import { generatePlan, scheduleDay, type PlanPrefs } from "./itinerary";
import { rankPlaces, scorePlace } from "./rank";
import type { Place } from "./types";

const base: Place = {
  id: "x", city: "t", name: "X", cat: "yemek", food: "kebap", district: "d", lat: 41, lng: 29,
  price: 2, vibes: [], why: ["a"], bestTime: "-", dur: 60, ed: 7,
};

describe("rank", () => {
  const ta = (rating: number, count: number, fetchedAt?: string) => ({ rating, count, fetchedAt });
  it("harici veri yokken editoryal puanı kullanır", () => {
    expect(scorePlace(base).score).toBe(7);
  });
  it("az yorumlu mükemmel TripAdvisor puanı, çok yorumlu iyi puanı geçemez", () => {
    const few = scorePlace({ ...base, tripadvisor: ta(5, 3) });
    const many = scorePlace({ ...base, tripadvisor: ta(4.6, 5000) });
    expect(many.score).toBeGreaterThan(few.score);
  });
  it("Google verisi skora GİRMEZ (saklanamayan içerik)", () => {
    const withGoogle = { ...base, google: { id: "ChIJabcdefghij", rating: 1, count: 99999 } } as unknown as Place;
    expect(scorePlace(withGoogle).score).toBe(scorePlace(base).score);
  });
  it("bayat TripAdvisor sinyali yok sayılır, taze olan sayılır", () => {
    const now = Date.parse("2026-10-13T00:00:00Z");
    const fresh = scorePlace({ ...base, tripadvisor: ta(5, 2000, "2026-10-01T00:00:00Z") }, now);
    const stale = scorePlace({ ...base, tripadvisor: ta(5, 2000, "2026-06-01T00:00:00Z") }, now);
    expect(fresh.score).toBeGreaterThan(base.ed);
    expect(stale.score).toBe(base.ed);
  });
  it("puana göre sıralar", () => {
    const r = rankPlaces([{ ...base, id: "a", ed: 5 }, { ...base, id: "b", ed: 9 }]);
    expect(r[0].id).toBe("b");
  });
});

describe("sinyal birleştirme (lisans güvencesi)", () => {
  it("yalnızca Google Place ID + TripAdvisor alınır; sızan Google puanı/saati/koordinatı reddedilir", () => {
    const leaked = {
      google: { id: "ChIJ-valid_PlaceId1", rating: 4.9, count: 100, url: "https://maps.google.com/x" },
      hours: [{ day: 1, open: 0, close: 60, closeDay: 1 }],
      lat: 1,
      lng: 2,
      tripadvisor: { rating: 4.5, count: 80, fetchedAt: "2026-10-01T00:00:00Z" },
    };
    const m = mergeSignals(base, leaked as never);
    expect(m.google).toEqual({ id: "ChIJ-valid_PlaceId1" });
    expect(m.hours).toBeUndefined();
    expect([m.lat, m.lng]).toEqual([base.lat, base.lng]);
    expect(m.tripadvisor?.rating).toBe(4.5);
  });
  it("geçersiz Place ID ve bozuk TripAdvisor kaydı atılır", () => {
    const m = mergeSignals(base, { google: { id: "../etc" }, tripadvisor: { rating: "x" } } as never);
    expect(m.google).toBeUndefined();
    expect(m.tripadvisor).toBeUndefined();
  });
});

describe("seed veri", () => {
  it("yedi şehir yüklü", () => {
    expect(loadAllCities().map((c) => c.slug).sort()).toEqual(["antalya", "bodrum", "gaziantep", "istanbul", "izmir", "kapadokya", "trabzon"]);
  });
  it("tüm şehirlerde id benzersiz, koordinatlar şehre yakın, gerekçe dolu", () => {
    for (const c of loadAllCities()) {
      const ids = new Set(c.places.map((p) => p.id));
      expect(ids.size).toBe(c.places.length);
      for (const p of c.places) {
        expect(p.why.length).toBeGreaterThan(0);
        expect(p.cat === "yemek" ? !!p.food : !p.food).toBe(true);
        expect(p.ed).toBeGreaterThanOrEqual(0);
        expect(p.ed).toBeLessThanOrEqual(10);
        // koordinat yazım hatası yakalayıcı: şehir merkezine en fazla 130 km (Efes, Ihlara, Uzungöl gibi gün gezileri dahil)
        expect(haversineKm(c, p), `${p.id} şehir merkezinden çok uzak`).toBeLessThan(130);
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
  it("seed koordinatından uzak Google sonucunu reddeder; yakın olanda yalnızca Place ID döner", async () => {
    process.env.GOOGLE_MAPS_API_KEY = "k";
    const { googleLookup } = await import("../../scripts/ingest");
    const mk = (lat: number) =>
      (async () =>
        new Response(
          JSON.stringify({ places: [{ id: "g1", rating: 4.5, userRatingCount: 100, location: { latitude: lat, longitude: 29 } }] }),
        )) as unknown as typeof fetch;
    expect(await googleLookup(base, "T", mk(45))).toBeNull();
    const ok = await googleLookup(base, "T", mk(41.001));
    expect(ok?.ref).toEqual({ id: "g1" }); // puan/yorum yanıtta olsa bile döndürülmez/saklanmaz
    expect(Object.keys(ok!.ref)).toEqual(["id"]);
  });
  it("Google isteği yalnızca id ve konum alanlarını ister (içerik alanı istenmez)", async () => {
    process.env.GOOGLE_MAPS_API_KEY = "k";
    const { googleLookup } = await import("../../scripts/ingest");
    let mask = "";
    const f = (async (_u: string, init: RequestInit) => {
      mask = (init.headers as Record<string, string>)["X-Goog-FieldMask"];
      return new Response(JSON.stringify({ places: [] }));
    }) as unknown as typeof fetch;
    await googleLookup(base, "T", f);
    expect(mask).toBe("places.id,places.location");
  });
});

import { checkVisit, istanbulNow, openStatus, periodsToHours, statusText, type Period } from "./hours";

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
  it("Google periyotlarını (canlı veri) dönüştürür", () => {
    expect(periodsToHours([{ open: { day: 1, hour: 9 }, close: { day: 1, hour: 17, minute: 30 } }])).toEqual([
      { day: 1, open: 540, close: 1050, closeDay: 1 },
    ]);
    expect(periodsToHours([{ open: { day: 0, hour: 0 } }])).toBe("24/7");
    expect(periodsToHours(undefined)).toBeUndefined();
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

import { decodePlan, encodePlan } from "./sharePlan";

describe("plan paylaşımı", () => {
  const ist = loadCity("istanbul")!;
  const ids = new Set(ist.places.map((p) => p.id));
  const prefs: PlanPrefs = { days: 2, pace: "yogun", interests: ["kultur", "doga", "eglence", "pub", "alisveris"], vibes: [], maxPrice: 4, startDow: 2 };

  it("encode → decode aynı planı verir (gün, slot dahil)", () => {
    const plan = generatePlan(ist.places, prefs);
    expect(decodePlan(encodePlan(plan), ids)).toEqual(plan);
  });
  it("bilinmeyen/yinelenen mekân ve geçersiz slot atılır", () => {
    const d = decodePlan("1.ist-van@yok,ist-van,sahte-id,<script>", ids);
    expect(d).toEqual({ days: [{ stops: [{ placeId: "ist-van" }], dow: 1 }] });
  });
  it("çöp girdiyi ve boş planı reddeder", () => {
    for (const bad of ["", "abc", "9.ist-van", "x.ist-van", ".ist-van", "-.sahte", "-." + "a".repeat(5000)])
      expect(decodePlan(bad, ids)).toBeNull();
    expect(decodePlan(Array(20).fill("-.ist-van").join("~"), ids)).toBeNull();
  });
});

import { applyOp, emptyState, parseOp, sanitizeName, sanitizePlan, type OpCtx, type RoomState } from "./collab";

describe("ortak plan işlemleri", () => {
  const ist = loadCity("istanbul")!;
  const valid = new Set(ist.places.map((p) => p.id));
  const ctx = (cid: string): OpCtx => ({ cid, name: cid, validIds: valid, nameOf: (id) => id });
  const run = (s: RoomState, op: Parameters<typeof applyOp>[1], cid = "a") => {
    const r = applyOp(s, op, ctx(cid));
    if (!r.ok) throw new Error(r.error);
    return r;
  };

  it("eşzamanlı eklemeler birbirini ezmez (sunucu sırayla uygular)", () => {
    let s = emptyState();
    s = run(s, { t: "add", placeId: "ist-van", day: 0 }, "ayse").state;
    s = run(s, { t: "add", placeId: "ist-moda", day: 0 }, "can").state;
    expect(s.plan.days[0].stops.map((x) => x.placeId)).toEqual(["ist-van", "ist-moda"]);
  });
  it("iki kişi aynı mekânı eklerse tek kez eklenir; çifte silme zararsız", () => {
    let s = run(emptyState(), { t: "add", placeId: "ist-van", day: 0 }).state;
    const dup = run(s, { t: "add", placeId: "ist-van", day: 0 }, "b");
    expect(dup.summary).toBe("");
    expect(dup.state.plan.days[0].stops).toHaveLength(1);
    s = run(s, { t: "remove", placeId: "ist-van" }).state;
    expect(run(s, { t: "remove", placeId: "ist-van" }, "b").summary).toBe("");
  });
  it("taşıma mekâna bağlı: araya başkası girse bile aynı mekân kayar", () => {
    let s = emptyState();
    for (const id of ["ist-van", "ist-moda", "ist-galata"]) s = run(s, { t: "add", placeId: id, day: 0 }).state;
    s = run(s, { t: "move", placeId: "ist-galata", dir: -1 }).state;
    expect(s.plan.days[0].stops.map((x) => x.placeId)).toEqual(["ist-van", "ist-galata", "ist-moda"]);
    expect(run(s, { t: "move", placeId: "ist-van", dir: -1 }).summary).toBe(""); // kenarda etkisiz
  });
  it("oy: aç/kapa, çıkarılan mekânın oyları silinir, planda olmayana oy reddedilir", () => {
    let s = run(emptyState(), { t: "add", placeId: "ist-van", day: 0 }).state;
    s = run(s, { t: "vote", placeId: "ist-van" }, "ayse").state;
    s = run(s, { t: "vote", placeId: "ist-van" }, "can").state;
    expect(Object.keys(s.votes["ist-van"])).toEqual(["ayse", "can"]);
    s = run(s, { t: "vote", placeId: "ist-van" }, "ayse").state;
    expect(Object.keys(s.votes["ist-van"])).toEqual(["can"]);
    expect(applyOp(s, { t: "vote", placeId: "ist-moda" }, ctx("a")).ok).toBe(false);
    expect(run(s, { t: "remove", placeId: "ist-van" }).state.votes).toEqual({});
  });
  it("gün işlemleri ve sınırlar", () => {
    let s = run(emptyState(), { t: "dow", day: 0, dow: 3 }).state;
    expect(s.plan.days[0].dow).toBe(3);
    s = run(s, { t: "dow", day: 0 }).state;
    expect("dow" in s.plan.days[0]).toBe(false);
    expect(applyOp(s, { t: "dow", day: 5, dow: 1 }, ctx("a")).ok).toBe(false);
    for (let i = 1; i < 14; i++) s = run(s, { t: "addDay" }).state;
    expect(applyOp(s, { t: "addDay" }, ctx("a")).ok).toBe(false);
  });
  it("applyOp state'i değiştirmez (saf)", () => {
    const s = emptyState();
    const snap = JSON.stringify(s);
    run(s, { t: "add", placeId: "ist-van", day: 0 });
    expect(JSON.stringify(s)).toBe(snap);
  });
  it("parseOp/sanitizePlan/sanitizeName güvenilmeyen girdiyi reddeder/temizler", () => {
    expect(parseOp({ t: "add", placeId: "yok", day: 0 }, valid)).toBeNull();
    expect(parseOp({ t: "add", placeId: "ist-van", day: "0" }, valid)).toBeNull();
    expect(parseOp({ t: "move", placeId: "ist-van", dir: 2 }, valid)).toBeNull();
    expect(parseOp({ t: "dow", day: 0, dow: 9 }, valid)).toBeNull();
    expect(parseOp({ t: "bilinmeyen" }, valid)).toBeNull();
    expect(parseOp(null, valid)).toBeNull();
    expect(parseOp({ t: "replace", plan: { days: [] } }, valid)).toBeNull();
    const p = sanitizePlan({ days: [{ stops: [{ placeId: "ist-van", slot: "kahvalti" }, { placeId: "ist-van" }, { placeId: "x" }, null], dow: 2 }] }, valid);
    expect(p).toEqual({ days: [{ stops: [{ placeId: "ist-van", slot: "kahvalti" }], dow: 2 }] });
    expect(sanitizeName("  <b>Ayşe\u0000</b>  ")).toBe("bAyşe/b");
    expect(sanitizeName("x".repeat(100))).toHaveLength(24);
    expect(sanitizeName(42)).toBe("Misafir");
    expect(sanitizeName("   ")).toBe("Misafir");
  });
});

describe("güneşe bağlı deneyimler", () => {
  const prefs: PlanPrefs = { days: 3, pace: "yogun", interests: ["kultur", "doga", "eglence", "pub", "alisveris"], vibes: [], maxPrice: 4 };
  it("gündoğumu (balon) otomatik plana girmez; gün batımı yeri 'Gün batımı' diliminde ve ≥17:30", () => {
    const kap = loadCity("kapadokya")!;
    const plan = generatePlan(kap.places, prefs);
    const stops = plan.days.flatMap((d) => d.stops);
    expect(stops.some((s) => s.placeId === "kap-balon")).toBe(false);
    const sunset = stops.find((s) => s.placeId === "kap-kizilcukur");
    expect(sunset?.slot).toBe("gunbatimi");
    const byId = new Map(kap.places.map((p) => [p.id, p]));
    for (const d of plan.days) {
      const timed = scheduleDay(d.stops.map((s) => ({ place: byId.get(s.placeId)!, slot: s.slot })));
      for (const t of timed) if (t.place.when === "sunset") expect(t.start).toBeGreaterThanOrEqual(17 * 60 + 30);
    }
  });
  it("gün batımı yerleri öğle/ikindi dilimlerine düşmez", () => {
    for (const c of loadAllCities()) {
      const sunsetIds = new Set(c.places.filter((p) => p.when === "sunset").map((p) => p.id));
      for (const d of generatePlan(c.places, prefs).days)
        for (const s of d.stops) if (sunsetIds.has(s.placeId)) expect(s.slot).toBe("gunbatimi");
    }
  });
});

describe("gün sınırları (tüm şehirler, tüm tempolar)", () => {
  const base: Omit<PlanPrefs, "pace"> = { days: 4, interests: ["kultur", "doga", "eglence", "pub", "alisveris"], vibes: [], maxPrice: 4 };
  it("hiçbir gün gece yarısını aşmaz; tam gün aktiviteler yalnızca sabah diliminde", () => {
    for (const c of loadAllCities()) {
      const byId = new Map(c.places.map((p) => [p.id, p]));
      for (const pace of ["rahat", "normal", "yogun"] as const) {
        for (const d of generatePlan(c.places, { ...base, pace }).days) {
          const timed = scheduleDay(d.stops.map((s) => ({ place: byId.get(s.placeId)!, slot: s.slot })));
          for (const t of timed) {
            expect(t.start, `${c.slug}/${pace}/${t.place.id}`).toBeLessThanOrEqual(23 * 60 + 30);
            if (t.place.dur >= 240) expect(t.slot).toBe("Sabah gezisi");
          }
          if (timed.length) expect(timed[timed.length - 1].end, `${c.slug}/${pace}`).toBeLessThanOrEqual(26 * 60);
        }
      }
    }
  });
  it("Bodrum'da tekne turu seçilirse o gün öğle yemeği atlanır (teknede)", () => {
    const bod = loadCity("bodrum")!;
    const plan = generatePlan(bod.places, { ...base, days: 3, pace: "normal" });
    const day = plan.days.find((d) => d.stops.some((s) => s.placeId === "bod-tekne"));
    if (day) expect(day.stops.map((s) => s.slot)).not.toContain("ogle");
  });
});
