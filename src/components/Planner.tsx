"use client";
import { useState } from "react";
import { CATEGORIES, PRICE_LABEL } from "@/lib/categories";
import { haversineKm, mapsUrl } from "@/lib/geo";
import { fmtTime, generatePlan, scheduleDay, type Pace, type PlanPrefs } from "@/lib/itinerary";
import { MapView } from "./MapLoader";
import { usePlan } from "@/lib/usePlan";
import type { Category, ScoredPlace } from "@/lib/types";

export function Planner({ slug, places, center }: { slug: string; places: ScoredPlace[]; center: [number, number] }) {
  const [mapDay, setMapDay] = useState<number | null>(null);
  const { plan, setPlan, ready } = usePlan(slug);
  const byId = new Map(places.map((p) => [p.id, p]));
  const [prefs, setPrefs] = useState<PlanPrefs>({
    days: 2,
    pace: "normal",
    interests: ["kultur", "doga", "eglence", "pub", "alisveris"],
    vibes: [],
    maxPrice: 4,
  });
  const [adding, setAdding] = useState<number | null>(null);

  const toggleInterest = (c: Category) =>
    setPrefs((p) => ({
      ...p,
      interests: p.interests.includes(c) ? p.interests.filter((x) => x !== c) : [...p.interests, c],
    }));

  const auto = () => {
    const next = generatePlan(places, prefs);
    setPlan(() => next);
  };

  const move = (d: number, i: number, dir: -1 | 1) =>
    setPlan((p) => ({
      days: p.days.map((day, di) => {
        if (di !== d) return day;
        const stops = [...day.stops];
        const j = i + dir;
        if (j < 0 || j >= stops.length) return day;
        [stops[i], stops[j]] = [stops[j], stops[i]];
        return { stops };
      }),
    }));
  const removeAt = (d: number, i: number) =>
    setPlan((p) => ({ days: p.days.map((day, di) => (di === d ? { stops: day.stops.filter((_, k) => k !== i) } : day)) }));
  const addTo = (d: number, id: string) =>
    setPlan((p) =>
      p.days.some((day) => day.stops.some((s) => s.placeId === id))
        ? p
        : { days: p.days.map((day, di) => (di === d ? { stops: [...day.stops, { placeId: id }] } : day)) },
    );
  const addDay = () => setPlan((p) => ({ days: [...p.days, { stops: [] }] }));

  const planned = new Set(plan.days.flatMap((d) => d.stops.map((s) => s.placeId)));

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white border border-stone-200 p-4 space-y-4">
        <h2 className="font-bold">⚡ Otomatik plan oluştur</h2>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            Gün
            <input
              type="number" min={1} max={7} value={prefs.days}
              onChange={(e) => setPrefs({ ...prefs, days: Math.min(7, Math.max(1, Number(e.target.value) || 1)) })}
              className="w-16 rounded-lg border border-stone-300 px-2 py-1"
            />
          </label>
          <label className="flex items-center gap-2">
            Tempo
            <select
              value={prefs.pace}
              onChange={(e) => setPrefs({ ...prefs, pace: e.target.value as Pace })}
              className="rounded-lg border border-stone-300 px-2 py-1"
            >
              <option value="rahat">Rahat (4 durak)</option>
              <option value="normal">Normal (5-6 durak)</option>
              <option value="yogun">Yoğun (7 durak)</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            Bütçe
            <select
              value={prefs.maxPrice}
              onChange={(e) => setPrefs({ ...prefs, maxPrice: Number(e.target.value) as PlanPrefs["maxPrice"] })}
              className="rounded-lg border border-stone-300 px-2 py-1"
            >
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>{n === 4 ? "Sınırsız" : `En fazla ${PRICE_LABEL[n]}`}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.filter((c) => c.id !== "yemek").map((c) => (
            <button
              key={c.id}
              onClick={() => toggleInterest(c.id)}
              className={`rounded-full border px-3 py-1 text-sm ${
                prefs.interests.includes(c.id) ? "bg-ink text-white border-ink" : "bg-white border-stone-300"
              }`}
            >
              {c.emoji} {c.label}
            </button>
          ))}
        </div>
        <button onClick={auto} className="rounded-full bg-brand text-white px-5 py-2 font-semibold">
          Planı oluştur
        </button>
        <p className="text-xs text-stone-500">
          Her gün için en yüksek puanlı gezilecek yer seçilir; yemek, kahve ve gece durakları puan + yakınlığa göre
          eklenir. Sonra elle düzenleyebilirsin.
        </p>
      </section>

      {!ready ? null : plan.days.map((day, d) => {
        const timed = scheduleDay(
          day.stops.flatMap((s) => {
            const place = byId.get(s.placeId);
            return place ? [{ place, slot: s.slot }] : [];
          }),
        );
        const km = timed.reduce((n, s, i) => n + (i ? haversineKm(timed[i - 1].place, s.place) : 0), 0);
        return (
          <section key={d} className="rounded-2xl bg-white border border-stone-200 p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg">{d + 1}. Gün</h2>
              <span className="text-xs text-stone-500">
                {timed.length > 0 && (
                  <button className="text-brand font-semibold mr-2" onClick={() => setMapDay(mapDay === d ? null : d)}>
                    {mapDay === d ? "Haritayı gizle" : "🗺️ Haritada gör"}
                  </button>
                )}
                {timed.length} durak · ~{km.toFixed(1)} km{timed.length ? ` · ${fmtTime(timed[0].start)}–${fmtTime(timed[timed.length - 1].end)}` : ""}
              </span>
            </div>
            {mapDay === d && timed.length > 0 && (
              <div className="mt-3">
                <MapView places={[]} route={timed.map((t) => t.place)} center={center} height="50vh" />
              </div>
            )}
            {timed.length === 0 && <p className="text-sm text-stone-500 py-3">Henüz durak yok.</p>}
            <ol className="mt-3 space-y-3">
              {timed.map((s, i) => (
                <li key={s.place.id} className="flex gap-3">
                  <div className="w-14 shrink-0 text-sm font-mono text-stone-500">
                    {fmtTime(s.start)}
                    {s.travelFromPrev > 0 && <div className="text-[10px]">🚶 {s.travelFromPrev} dk</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold">
                      {s.place.name} <span className="text-xs font-normal text-stone-500">{s.slot ?? ""}</span>
                    </p>
                    <p className="text-sm text-stone-600">{s.place.why[0]}</p>
                    <p className="text-xs text-stone-500 mt-1">
                      ~{s.place.dur} dk · {s.place.district} ·{" "}
                      <a className="underline" href={mapsUrl(s.place)} target="_blank" rel="noopener noreferrer">Harita</a>
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 text-xs">
                    <button aria-label="Yukarı" onClick={() => move(d, i, -1)} disabled={i === 0} className="disabled:opacity-30">▲</button>
                    <button aria-label="Aşağı" onClick={() => move(d, i, 1)} disabled={i === timed.length - 1} className="disabled:opacity-30">▼</button>
                    <button aria-label="Kaldır" onClick={() => removeAt(d, i)}>✕</button>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-3">
              {adding === d ? (
                <select
                  autoFocus
                  defaultValue=""
                  onChange={(e) => { if (e.target.value) addTo(d, e.target.value); setAdding(null); }}
                  onBlur={() => setAdding(null)}
                  className="w-full rounded-lg border border-stone-300 px-2 py-2 text-sm"
                >
                  <option value="">Mekân seç…</option>
                  {places.filter((p) => !planned.has(p.id)).map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.score.toFixed(1)})</option>
                  ))}
                </select>
              ) : (
                <button onClick={() => setAdding(d)} className="text-sm text-brand font-semibold">+ Durak ekle</button>
              )}
            </div>
          </section>
        );
      })}
      {ready && (
        <button onClick={addDay} className="text-sm text-brand font-semibold">+ Gün ekle</button>
      )}
    </div>
  );
}
