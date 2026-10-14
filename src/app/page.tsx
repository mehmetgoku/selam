import { HomeView } from "@/components/views";
import { loadAllCities } from "@/lib/data";

export default function Home() {
  return <HomeView cities={loadAllCities()} />;
}
