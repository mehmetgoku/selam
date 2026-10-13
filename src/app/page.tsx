import Link from "next/link";
import { loadAllCities } from "@/lib/data";

export default function Home() {
  const cities = loadAllCities();
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
            <div className="flex items-baseline justify-between">
              <h2 className="text-xl font-bold group-hover:text-brand">{c.name}</h2>
              <span className="text-xs text-stone-500">{c.region} · {c.places.length} mekân</span>
            </div>
            <p className="mt-1 text-stone-600">{c.tagline}</p>
            <p className="mt-3 text-sm text-stone-500">
              {c.signatureDishes.slice(0, 4).join(" · ")}
            </p>
          </Link>
        ))}
      </section>
    </div>
  );
}
