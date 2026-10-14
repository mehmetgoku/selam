import { notFound } from "next/navigation";
import { CityView } from "@/components/views";
import { listCitySlugs, loadCity } from "@/lib/data";

export const generateStaticParams = () => listCitySlugs().map((slug) => ({ slug }));

export default async function CityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const city = loadCity(slug);
  if (!city) notFound();
  return <CityView city={city} />;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const city = loadCity(slug);
  return { title: city ? `${city.name} gezi rehberi — Selam` : "Selam" };
}
