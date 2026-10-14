import { createRoot } from "react-dom/client";
import cities from "virtual:cities";
import { CityView, HomeView, PlanView } from "@/components/views";
import { rankPlaces } from "@/lib/rank";
import type { CityData } from "@/lib/types";
import Link from "./shims/link";
import { usePath } from "./shims/router";

const DATA: CityData[] = cities
  .map((c) => ({ ...c, places: rankPlaces(c.places.map((p) => ({ ...p, city: c.slug }))) }))
  .sort((a, b) => a.name.localeCompare(b.name, "tr"));

function App() {
  const path = usePath();
  const m = path.match(/^\/sehir\/([a-z0-9-]+)(\/plan)?\/?$/);
  const city = m ? DATA.find((c) => c.slug === m[1]) : undefined;
  return (
    <>
      <header className="border-b border-stone-200 bg-white/90 backdrop-blur sticky z-20" style={{ top: "env(safe-area-inset-top, 0px)" }}>
        <div className="gutter mx-auto max-w-5xl h-14 flex items-center justify-between">
          <Link href="/" className="font-bold text-lg text-brand">
            Selam<span className="text-ink"> · Türkiye</span>
          </Link>
          <span className="text-xs text-stone-500">Demo</span>
        </div>
      </header>
      <p className="gutter mx-auto max-w-5xl pt-3 text-xs text-stone-500">
        Demo sürümü: mekân bilgileri henüz doğrulanmadı. Gitmeden önce çalışma saatini kontrol et.
      </p>
      <main className="gutter mx-auto max-w-5xl py-6">
        {city ? (m![2] ? <PlanView city={city} /> : <CityView city={city} />) : <HomeView cities={DATA} />}
      </main>
    </>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
