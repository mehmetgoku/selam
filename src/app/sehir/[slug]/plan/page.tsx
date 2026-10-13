import Link from "next/link";
import { notFound } from "next/navigation";
import { Planner } from "@/components/Planner";
import { listCitySlugs, loadCity } from "@/lib/data";

export const generateStaticParams = () => listCitySlugs().map((slug) => ({ slug }));

export default async function PlanPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const city = loadCity(slug);
  if (!city) notFound();
  return (
    <div className="space-y-5">
      <Link href={`/sehir/${slug}`} className="text-sm text-stone-500 hover:text-brand">← {city.name} rehberi</Link>
      <h1 className="text-3xl font-extrabold">{city.name} gezi planı</h1>
      <Planner slug={slug} cityName={city.name} places={city.places} center={[city.lat, city.lng]} />
    </div>
  );
}
