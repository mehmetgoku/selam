"use client";
import { useSyncExternalStore } from "react";
import { GOOGLE_KEY, loadGoogle } from "./googleMaps";
import { periodsToHours, type Hours } from "./hours";

/**
 * Google Places içeriği (puan, yorum sayısı, çalışma saatleri) — CANLI ve YALNIZCA BELLEKTE.
 * Lisans gereği diske, localStorage'a, sunucuya yazılmaz; sayfa yenilenince kaybolur.
 * Her çağrı faturalandırılır: yalnızca kullanıcı isteyince (düğme / "şu an açık" filtresi / gün seçimi) tetiklenir.
 */
export interface Live {
  rating?: number;
  count?: number;
  hours?: Hours;
}
type Entry = { state: "loading" } | { state: "done"; data: Live } | { state: "error" };

const store = new Map<string, Entry>();
const listeners = new Set<() => void>();
let version = 0;
const bump = () => {
  version++;
  listeners.forEach((l) => l());
};

const CONCURRENCY = 4;
let running = 0;
const queue: (() => Promise<void>)[] = [];
const pump = () => {
  while (running < CONCURRENCY && queue.length) {
    const job = queue.shift()!;
    running++;
    job().finally(() => {
      running--;
      pump();
    });
  }
};

async function fetchOne(googleId: string) {
  try {
    await loadGoogle();
    const { Place } = (await google.maps.importLibrary("places")) as google.maps.PlacesLibrary;
    const place = new Place({ id: googleId });
    await place.fetchFields({ fields: ["rating", "userRatingCount", "regularOpeningHours"] });
    store.set(googleId, {
      state: "done",
      data: {
        rating: place.rating ?? undefined,
        count: place.userRatingCount ?? undefined,
        hours: periodsToHours(place.regularOpeningHours?.periods as Parameters<typeof periodsToHours>[0]),
      },
    });
  } catch {
    store.set(googleId, { state: "error" });
  }
  bump();
}

/** Google Place ID'leri için canlı veriyi ister (zaten istenmiş/yüklenmişse atlar). */
export function ensureLive(googleIds: (string | undefined)[]) {
  if (!GOOGLE_KEY) return;
  let any = false;
  for (const id of new Set(googleIds)) {
    if (!id || store.has(id)) continue;
    store.set(id, { state: "loading" });
    queue.push(() => fetchOne(id));
    any = true;
  }
  if (any) {
    bump();
    pump();
  }
}

export function useLive() {
  const v = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => version,
    () => 0,
  );
  return {
    /** Google anahtarı tanımlı mı (yoksa canlı veri hiç sunulmaz) */
    available: !!GOOGLE_KEY,
    version: v,
    state: (id?: string) => (id ? store.get(id)?.state : undefined) ?? "idle",
    get: (id?: string): Live | undefined => {
      const e = id ? store.get(id) : undefined;
      return e?.state === "done" ? e.data : undefined;
    },
  };
}

/** İstenen kimliklerin hepsi yüklenene (ya da hata verene) kadar bekler; en fazla `timeoutMs`. */
export function waitLive(googleIds: (string | undefined)[], timeoutMs = 15_000): Promise<void> {
  const ids = [...new Set(googleIds.filter((i): i is string => !!i))];
  const pending = () => ids.some((id) => store.get(id)?.state === "loading");
  if (!GOOGLE_KEY || !pending()) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      listeners.delete(check);
      clearTimeout(t);
      resolve();
    };
    const check = () => !pending() && done();
    const t = setTimeout(done, timeoutMs);
    listeners.add(check);
  });
}
