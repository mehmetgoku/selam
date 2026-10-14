import { notFound } from "next/navigation";
import { PlanView } from "@/components/views";
import { listCitySlugs, loadCity } from "@/lib/data";

export const generateStaticParams = () => listCitySlugs().map((slug) => ({ slug }));

export default async function PlanPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const city = loadCity(slug);
  if (!city) notFound();
  return <PlanView city={city} />;
}
