import Link from "next/link";
import { notFound } from "next/navigation";
import { CityExplorer } from "@/components/CityExplorer";
import { listCitySlugs, loadCity } from "@/lib/data";

export const generateStaticParams = () => listCitySlugs().map((slug) => ({ slug }));

export default async function CityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const city = loadCity(slug);
  if (!city) notFound();
  return (
    <div className="space-y-5">
      <Link href="/" className="text-sm text-stone-500 hover:text-brand">← Tüm şehirler</Link>
      <section>
        <h1 className="text-3xl font-extrabold">{city.name}</h1>
        <p className="text-brand font-medium">{city.tagline}</p>
        <p className="mt-2 text-stone-700 max-w-3xl">{city.intro}</p>
        <p className="mt-2 text-sm text-stone-500">
          İmza lezzetler: {city.signatureDishes.join(" · ")}
        </p>
      </section>
      <CityExplorer slug={city.slug} places={city.places} />
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const city = loadCity(slug);
  return { title: city ? `${city.name} gezi rehberi — Selam` : "Selam" };
}
