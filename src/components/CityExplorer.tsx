"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { CATEGORIES, FOOD_TYPES, PRICE_LABEL, VIBES } from "@/lib/categories";
import { usePlan } from "@/lib/usePlan";
import type { Category, FoodType, ScoredPlace, Vibe } from "@/lib/types";
import { PlaceCard } from "./PlaceCard";

const chip = (active: boolean) =>
  `whitespace-nowrap rounded-full border px-3 py-1.5 text-sm ${
    active ? "bg-ink text-white border-ink" : "bg-white border-stone-300 text-stone-700 hover:border-ink"
  }`;

export function CityExplorer({ slug, places }: { slug: string; places: ScoredPlace[] }) {
  const [cat, setCat] = useState<Category | "hepsi">("hepsi");
  const [food, setFood] = useState<FoodType | null>(null);
  const [vibe, setVibe] = useState<Vibe | null>(null);
  const [maxPrice, setMaxPrice] = useState<1 | 2 | 3 | 4>(4);
  const { has, add, remove, count } = usePlan(slug);

  const filtered = useMemo(
    () =>
      places.filter(
        (p) =>
          (cat === "hepsi" || p.cat === cat) &&
          (!food || p.food === food) &&
          (!vibe || p.vibes.includes(vibe)) &&
          p.price <= maxPrice,
      ),
    [places, cat, food, vibe, maxPrice],
  );

  const card = (p: ScoredPlace, rank?: number) => (
    <PlaceCard key={p.id} place={p} rank={rank} inPlan={has(p.id)} onToggle={() => (has(p.id) ? remove(p.id) : add(p.id))} />
  );

  // Gruplu görünümler: "Hepsi" → kategori başına en iyi 3; "Yemek" → tür başına en iyi 3
  let sections: { title: string; items: ScoredPlace[] }[] | null = null;
  if (cat === "hepsi") {
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
      <div className="space-y-3 sticky top-14 z-10 -mx-4 px-4 py-3 bg-paper/95 backdrop-blur border-b border-stone-200">
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button className={chip(cat === "hepsi")} onClick={() => { setCat("hepsi"); setFood(null); }}>
            ✨ Hepsi
          </button>
          {CATEGORIES.map((c) => (
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
          <Link
            href={`/sehir/${slug}/plan`}
            className="ml-auto rounded-full bg-brand text-white px-4 py-1.5 font-semibold"
          >
            Planım ({count})
          </Link>
        </div>
      </div>

      {filtered.length === 0 && (
        <p className="text-stone-500 py-10 text-center">Bu filtrelerle mekân yok — filtreleri gevşet.</p>
      )}

      {sections
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
