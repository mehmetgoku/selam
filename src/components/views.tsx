import Link from "next/link";
import type { CityData } from "@/lib/types";
import { CityExplorer } from "./CityExplorer";
import { Planner } from "./Planner";

export function HomeView({ cities }: { cities: CityData[] }) {
  return (
    <div className="space-y-8">
      <section className="rounded-3xl bg-brand-soft p-6 sm:p-10">
        <h1 className="text-3xl sm:text-4xl font-extrabold leading-tight">
          Nereye gideceğini değil, <span className="text-brand">neden orada yiyeceğini</span> bil.
        </h1>
        <p className="mt-3 max-w-2xl text-stone-700">
          Her şehir kategorilere ayrılmış; yemekte kebaptan baklavaya her türün “en”leri çıkarılmış; her mekânın
          yanında neden iyi olduğu yazıyor. Beğendiklerini ekle, saat saat gezi planı hazır.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {cities.map((c) => (
          <Link
            key={c.slug}
            href={`/sehir/${c.slug}`}
            className="group rounded-2xl bg-white border border-stone-200 p-5 hover:border-brand transition"
          >
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-xl font-bold group-hover:text-brand">{c.name}</h2>
              <span className="text-xs text-stone-500 text-right">{c.region} · {c.places.length} mekân</span>
            </div>
            <p className="mt-1 text-stone-600">{c.tagline}</p>
            <p className="mt-3 text-sm text-stone-500">{c.signatureDishes.slice(0, 4).join(" · ")}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}

export function CityView({ city }: { city: CityData }) {
  return (
    <div className="space-y-5">
      <Link href="/" className="text-sm text-stone-500 hover:text-brand">← Tüm şehirler</Link>
      <section>
        <h1 className="text-3xl font-extrabold">{city.name}</h1>
        <p className="text-brand font-medium">{city.tagline}</p>
        <p className="mt-2 text-stone-700 max-w-3xl">{city.intro}</p>
        <p className="mt-2 text-sm text-stone-500">İmza lezzetler: {city.signatureDishes.join(" · ")}</p>
      </section>
      <CityExplorer slug={city.slug} places={city.places} center={[city.lat, city.lng]} />
    </div>
  );
}

export function PlanView({ city }: { city: CityData }) {
  return (
    <div className="space-y-5">
      <Link href={`/sehir/${city.slug}`} className="text-sm text-stone-500 hover:text-brand">← {city.name} rehberi</Link>
      <h1 className="text-3xl font-extrabold">{city.name} gezi planı</h1>
      <Planner slug={city.slug} cityName={city.name} places={city.places} center={[city.lat, city.lng]} />
    </div>
  );
}
