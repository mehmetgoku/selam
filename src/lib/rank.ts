import type { Place, ScoredPlace, SourceSignal } from "./types";

/** Bayes ortalaması: az yorumlu yerler şehir ortalamasına çekilir. 1-5 ölçeği döner. */
export function bayes(sig: SourceSignal, prior = 4.0, m = 40) {
  return (sig.rating * sig.count + prior * m) / (sig.count + m);
}

const to10 = (r5: number) => Math.max(0, Math.min(10, ((r5 - 3) / 2) * 10)); // 3★→0, 5★→10

/**
 * Nihai skor (0-10).
 * - Harici veri yoksa: editoryal puan.
 * - Varsa: kaynakları yorum sayısının log'u ile ağırlıklayıp (Bayes düzeltmeli) editoryalle %60/%40 harmanlar.
 */
export function scorePlace(p: Place): ScoredPlace {
  const sources = [p.google, p.tripadvisor].filter(
    (s): s is SourceSignal => !!s && s.count > 0,
  );
  let score = p.ed;
  if (sources.length) {
    let wSum = 0;
    let acc = 0;
    for (const s of sources) {
      const w = Math.log10(s.count + 10);
      acc += to10(bayes(s)) * w;
      wSum += w;
    }
    score = 0.6 * (acc / wSum) + 0.4 * p.ed;
  }
  let localness: number | undefined;
  if (p.google && p.tripadvisor && p.google.count + p.tripadvisor.count > 0) {
    // Google yorumcuları ağırlıkla yerel; TripAdvisor turist ağırlıklı → oran bir "yerel" göstergesi
    localness = p.google.count / (p.google.count + p.tripadvisor.count);
  }
  return { ...p, score: Math.round(score * 10) / 10, localness };
}

export const rankPlaces = (places: Place[]) =>
  places.map(scorePlace).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "tr"));
