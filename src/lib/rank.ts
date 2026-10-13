import type { Place, ScoredPlace, SourceSignal } from "./types";

/** Bu kadar günden eski harici sinyal yok sayılır (şartlara uygun yenileme için); 0 = sınırsız. */
export const MAX_SIGNAL_AGE_DAYS = Number(process.env.SIGNAL_MAX_AGE_DAYS ?? 30);

/** Bayes ortalaması: az yorumlu yerler şehir ortalamasına çekilir. 1-5 ölçeği döner. */
export function bayes(sig: SourceSignal, prior = 4.0, m = 40) {
  return (sig.rating * sig.count + prior * m) / (sig.count + m);
}

const to10 = (r5: number) => Math.max(0, Math.min(10, ((r5 - 3) / 2) * 10)); // 3★→0, 5★→10

export function isFresh(sig: SourceSignal, now = Date.now(), maxAgeDays = MAX_SIGNAL_AGE_DAYS) {
  if (!maxAgeDays || !sig.fetchedAt) return true;
  const t = Date.parse(sig.fetchedAt);
  return Number.isNaN(t) || now - t <= maxAgeDays * 86_400_000;
}

/**
 * Nihai skor (0-10) = editoryal puan + TripAdvisor (varsa, taze ve yorumlu ise).
 * Google verisi kasıtlı olarak SKORA GİRMEZ (saklanamayan içerik; yalnızca canlı rozet olarak gösterilir).
 * TripAdvisor varsa: Bayes düzeltmeli TA puanı %60, editoryal %40.
 */
export function scorePlace(p: Place, now = Date.now()): ScoredPlace {
  const ta = p.tripadvisor && p.tripadvisor.count > 0 && isFresh(p.tripadvisor, now) ? p.tripadvisor : null;
  const score = ta ? 0.6 * to10(bayes(ta)) + 0.4 * p.ed : p.ed;
  return { ...p, score: Math.round(score * 10) / 10 };
}

export const rankPlaces = (places: Place[]) =>
  places.map((p) => scorePlace(p)).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "tr"));
