"use client";
import { catEmoji, catLabel, foodLabel, PRICE_LABEL, vibeLabel } from "@/lib/categories";
import { mapsUrl } from "@/lib/geo";
import { openStatus, statusText, type Now } from "@/lib/hours";
import { ensureLive, useLive } from "@/lib/live";
import type { ScoredPlace } from "@/lib/types";

export function PlaceCard({
  place,
  rank,
  inPlan,
  onToggle,
  now,
  distanceKm,
}: {
  place: ScoredPlace;
  rank?: number;
  inPlan?: boolean;
  onToggle?: () => void;
  now?: Now | null;
  /** "Yakınımda" açıkken kullanıcıya uzaklık (km) */
  distanceKm?: number;
}) {
  const { tripadvisor } = place;
  const live = useLive();
  const gid = place.google?.id;
  const liveData = live.get(gid);
  const liveState = live.state(gid);
  // Canlı Google saati varsa o; yoksa editoryal "24/7" (açık alan) bilgisi
  const st = now ? openStatus(liveData?.hours ?? place.hours, now) : null;
  const stText = st && now ? statusText(st, now) : null;
  return (
    <article className="rounded-2xl border border-stone-200 bg-white p-4 flex flex-col gap-3">
      <header className="flex items-start gap-3">
        {rank !== undefined && (
          <span className="shrink-0 w-7 h-7 rounded-full bg-brand text-white text-sm font-bold grid place-items-center">
            {rank}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="font-bold leading-snug">{place.name}</h3>
          <p className="text-xs text-stone-500">
            {catEmoji(place.cat)} {place.food ? foodLabel(place.food) : catLabel(place.cat)} · {place.district} ·{" "}
            {PRICE_LABEL[place.price]}{distanceKm !== undefined && ` · 📍 ${distanceKm < 1 ? `${Math.round(distanceKm * 10) * 100} m` : `${distanceKm.toFixed(1)} km`}`}
          </p>
        </div>
        <div className="shrink-0 text-right" title="Selam skoru: dış puanlar + editoryal değerlendirme">
          <div className="text-lg font-extrabold text-brand leading-none">{place.score.toFixed(1)}</div>
          <div className="text-[10px] uppercase tracking-wide text-stone-400">skor</div>
        </div>
      </header>

      {st && stText && (
        <p
          className={`text-xs font-semibold rounded-full px-2.5 py-1 self-start ${
            st.state === "closed"
              ? "bg-red-50 text-red-700"
              : st.state === "open" && st.minutesLeft <= 60
                ? "bg-amber-50 text-amber-700"
                : "bg-green-50 text-green-700"
          }`}
        >
          {stText}
        </p>
      )}

      {gid && live.available && (
        <div className="text-xs text-stone-600">
          {liveState === "done" && liveData ? (
            <span title="Google'dan canlı alındı; kaydedilmez">
              <strong>Google</strong>{" "}
              {liveData.rating !== undefined ? `★ ${liveData.rating.toFixed(1)} (${liveData.count ?? 0} yorum)` : "puan yok"} · canlı
              {liveData.hours === undefined && " · çalışma saati yok"}
            </span>
          ) : liveState === "loading" ? (
            <span>Google’dan alınıyor…</span>
          ) : liveState === "error" ? (
            <button className="underline" onClick={() => ensureLive([gid])}>Google verisi alınamadı — tekrar dene</button>
          ) : (
            <button className="underline hover:text-brand" onClick={() => ensureLive([gid])}>
              🔎 Google puanı ve çalışma saatleri
            </button>
          )}
        </div>
      )}

      <div>
        <p className="text-xs font-semibold text-stone-500 mb-1">Neden iyi?</p>
        <ul className="space-y-1 text-sm text-stone-700 list-disc pl-4">
          {place.why.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      </div>

      {place.mustTry && (
        <p className="text-sm">
          <span className="font-semibold">Mutlaka dene: </span>
          {place.mustTry.join(", ")}
        </p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {place.vibes.map((v) => (
          <span key={v} className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
            {vibeLabel(v)}
          </span>
        ))}
      </div>

      <footer className="mt-auto flex items-center justify-between gap-2 text-xs text-stone-500">
        <span>
          🕐 {place.bestTime} · ~{place.dur} dk
          {tripadvisor && (
            <>
              {" "}· {tripadvisor.url ? (
                <a href={tripadvisor.url} target="_blank" rel="noopener noreferrer" className="underline">TripAdvisor</a>
              ) : "TripAdvisor"}{" "}
              {tripadvisor.rating.toFixed(1)} ({tripadvisor.count})
            </>
          )}
        </span>
        <span className="flex items-center gap-2 shrink-0">
          <a
            href={mapsUrl(place)}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-brand"
          >
            Harita
          </a>
          {onToggle && (
            <button
              onClick={onToggle}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
                inPlan ? "bg-stone-200 text-stone-700" : "bg-brand text-white hover:opacity-90"
              }`}
            >
              {inPlan ? "Plandan çıkar" : "+ Plana ekle"}
            </button>
          )}
        </span>
      </footer>
    </article>
  );
}
