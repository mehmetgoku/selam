"use client";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { CATEGORIES, FOOD_TYPES, PRICE_LABEL, VIBES } from "@/lib/categories";
import { haversineKm } from "@/lib/geo";
import { openStatus } from "@/lib/hours";
import { getPosition } from "@/lib/platform";
import { ensureLive, useLive } from "@/lib/live";
import { useNow } from "@/lib/useNow";
import { usePlan } from "@/lib/usePlan";
import type { Category, FoodType, ScoredPlace, Vibe } from "@/lib/types";
import { MapView } from "./MapLoader";
import { PlaceCard } from "./PlaceCard";

const chip = (active: boolean) =>
  `whitespace-nowrap rounded-full border px-3 py-1.5 text-sm ${
    active ? "bg-ink text-white border-ink" : "bg-white border-stone-300 text-stone-700 hover:border-ink"
  }`;

export function CityExplorer({ slug, places, center }: { slug: string; places: ScoredPlace[]; center: [number, number] }) {
  const [view, setView] = useState<"liste" | "harita">("liste");
  const [cat, setCat] = useState<Category | "hepsi">("hepsi");
  const [food, setFood] = useState<FoodType | null>(null);
  const [vibe, setVibe] = useState<Vibe | null>(null);
  const [maxPrice, setMaxPrice] = useState<1 | 2 | 3 | 4>(4);
  const [openOnly, setOpenOnly] = useState(false);
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [nearMsg, setNearMsg] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  // Konum yalnızca cihazda sıralama için kullanılır; sunucuya gönderilmez, saklanmaz.
  const toggleNear = async () => {
    if (pos) return setPos(null);
    setLocating(true);
    setNearMsg(null);
    try {
      const p = await getPosition();
      if (haversineKm(p, { lat: center[0], lng: center[1] }) > 80) {
        setNearMsg("Şu an bu şehirde görünmüyorsun; “Yakınımda” şehre vardığında çalışır.");
      } else setPos(p);
    } catch {
      setNearMsg("Konum alınamadı. Konum iznini kontrol et.");
    } finally {
      setLocating(false);
    }
  };
  const now = useNow();
  const live = useLive();
  /** Etkin çalışma saati: canlı Google saati (varsa) yoksa editoryal "24/7". Google saati hiçbir yere kaydedilmez. */
  const hoursOf = useCallback((p: ScoredPlace) => live.get(p.google?.id)?.hours ?? p.hours, [live.version]); // eslint-disable-line react-hooks/exhaustive-deps
  const { has, add, remove, count } = usePlan(slug);

  const isClosed = useCallback(
    (id: string) => {
      const p = places.find((x) => x.id === id);
      return !!now && !!p && openStatus(hoursOf(p), now).state === "closed";
    },
    [places, now, hoursOf],
  );

  const filtered = useMemo(() => {
    const list = places.filter(
        (p) =>
          (cat === "hepsi" || p.cat === cat) &&
          (!food || p.food === food) &&
          (!vibe || p.vibes.includes(vibe)) &&
          p.price <= maxPrice &&
          (!openOnly || !now || openStatus(hoursOf(p), now).state !== "closed"),
    );
    return pos ? list.sort((a, b) => haversineKm(pos, a) - haversineKm(pos, b)) : list;
  }, [places, cat, food, vibe, maxPrice, openOnly, now, hoursOf, pos]);

  const card = (p: ScoredPlace, rank?: number) => (
    <PlaceCard key={p.id} place={p} now={now} rank={rank} distanceKm={pos ? haversineKm(pos, p) : undefined} inPlan={has(p.id)} onToggle={() => (has(p.id) ? remove(p.id) : add(p.id))} />
  );

  // Gruplu görünümler: "Hepsi" → kategori başına en iyi 3; "Yemek" → tür başına en iyi 3
  let sections: { title: string; items: ScoredPlace[] }[] | null = null;
  if (pos) {
    sections = null; // "Yakınımda": düz liste, en yakından uzağa
  } else if (cat === "hepsi") {
    sections = CATEGORIES.map((c) => ({
      title: `${c.emoji} Şehrin en iyileri · ${c.label}`,
      items: filtered.filter((p) => p.cat === c.id).slice(0, 3),
    })).filter((s) => s.items.length);
  } else if (cat === "yemek" && !food) {
    sections = FOOD_TYPES.map((f) => ({
      title: `${f.emoji} En iyi ${f.label}`,
      items: filtered.filter((p) => p.food === f.id).slice(0, 3),
    })).filter((s) => s.items.length);
  }

  return (
    <div className="space-y-5">
      <div style={{ top: "calc(3.5rem + env(safe-area-inset-top))" }} className="space-y-3 sticky z-10 -mx-4 px-4 py-3 bg-paper/95 backdrop-blur border-b border-stone-200">
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button className={chip(cat === "hepsi")} onClick={() => { setCat("hepsi"); setFood(null); }}>
            ✨ Hepsi
          </button>
          {CATEGORIES.filter((c) => places.some((p) => p.cat === c.id)).map((c) => (
            <button key={c.id} className={chip(cat === c.id)} onClick={() => { setCat(c.id); setFood(null); }}>
              {c.emoji} {c.label}
            </button>
          ))}
        </div>
        {cat === "yemek" && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button className={chip(food === null)} onClick={() => setFood(null)}>Tüm yemekler</button>
            {FOOD_TYPES.map((f) => (
              <button key={f.id} className={chip(food === f.id)} onClick={() => setFood(f.id)}>
                {f.emoji} {f.label}
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <select
            aria-label="Ortam"
            value={vibe ?? ""}
            onChange={(e) => setVibe((e.target.value || null) as Vibe | null)}
            className="rounded-full border border-stone-300 bg-white px-3 py-1.5"
          >
            <option value="">Her ortam</option>
            {VIBES.map((v) => (
              <option key={v.id} value={v.id}>{v.label}</option>
            ))}
          </select>
          <select
            aria-label="Bütçe"
            value={maxPrice}
            onChange={(e) => setMaxPrice(Number(e.target.value) as 1 | 2 | 3 | 4)}
            className="rounded-full border border-stone-300 bg-white px-3 py-1.5"
          >
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>{n === 4 ? "Her bütçe" : `En fazla ${PRICE_LABEL[n]}`}</option>
            ))}
          </select>
          <button
            aria-pressed={!!pos}
            onClick={toggleNear}
            disabled={locating}
            className={chip(!!pos)}
            title="Konumun yalnızca cihazında kullanılır; sunucuya gönderilmez"
          >
            📍 {locating ? "Konum alınıyor…" : "Yakınımda"}
          </button>
          <button
            aria-pressed={openOnly}
            onClick={() => {
              const next = !openOnly;
              setOpenOnly(next);
              if (next) ensureLive(places.map((p) => p.google?.id)); // kullanıcı isteğiyle: saatleri Google'dan canlı al
            }}
            className={chip(openOnly)}
            title="Kapalı olduğu kesin olan mekânları gizler; saati bilinmeyenler listede kalır. Saatler Google'dan canlı alınır."
          >
            🟢 Şu an açık
          </button>
          <div className="flex rounded-full border border-stone-300 bg-white overflow-hidden" role="group" aria-label="Görünüm">
            {(["liste", "harita"] as const).map((v) => (
              <button
                key={v}
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 ${view === v ? "bg-ink text-white" : ""}`}
              >
                {v === "liste" ? "☰ Liste" : "🗺️ Harita"}
              </button>
            ))}
          </div>
          <Link
            href={`/sehir/${slug}/plan`}
            className="ml-auto rounded-full bg-brand text-white px-4 py-1.5 font-semibold"
          >
            Planım ({count})
          </Link>
        </div>
      </div>

      {nearMsg && <p role="status" className="text-sm text-stone-600">{nearMsg}</p>}
      {pos && <p className="text-xs text-stone-500">En yakından uzağa sıralı. Konumun cihazında kalır, kaydedilmez.</p>}
      {openOnly && now && (
        <p className="text-xs text-stone-500">
          İstanbul saatiyle {String(Math.floor(now.minute / 60)).padStart(2, "0")}:{String(now.minute % 60).padStart(2, "0")}.{" "}
          {(() => {
            const unknown = filtered.filter((p) => openStatus(hoursOf(p), now).state === "unknown").length;
            return unknown
              ? `${unknown} mekânın çalışma saati bilinmiyor, bu yüzden listede kaldı. Saatler Google'dan canlı alınır${live.available ? "" : " (Google anahtarı tanımlı değil)"}; kaydedilmez.`
              : "Listedeki tüm mekânların saati biliniyor.";
          })()}
        </p>
      )}

      {filtered.length === 0 && (
        <p className="text-stone-500 py-10 text-center">Bu filtrelerle mekân yok — filtreleri gevşet.</p>
      )}

      {view === "harita" && filtered.length > 0 ? (
        <MapView
          places={filtered}
          center={center}
          inPlan={has}
          dim={isClosed}
          onToggle={(id) => (has(id) ? remove(id) : add(id))}
        />
      ) : sections
        ? sections.map((s) => (
            <section key={s.title} className="space-y-3">
              <h2 className="text-lg font-bold">{s.title}</h2>
              <div className="grid gap-4 md:grid-cols-3">
                {s.items.map((p, i) => card(p, i + 1))}
              </div>
            </section>
          ))
        : (
          <div className="grid gap-4 md:grid-cols-2">{filtered.map((p, i) => card(p, i + 1))}</div>
        )}
    </div>
  );
}
