import type { Hours } from "./hours";

export type Category = "yemek" | "kultur" | "doga" | "eglence" | "pub" | "alisveris";

export type FoodType =
  | "kahvalti"
  | "kebap"
  | "pide-lahmacun"
  | "balik"
  | "lokanta"
  | "sokak"
  | "meyhane"
  | "tatli"
  | "kahve";

export type Vibe =
  | "ogrenci"
  | "romantik"
  | "grup"
  | "manzara"
  | "gece"
  | "yerel"
  | "aile"
  | "butce-dostu"
  | "fotograf";

/** TripAdvisor sinyali (saklanabilir; `fetchedAt` ile bayatlık kontrolü yapılır). */
export interface SourceSignal {
  rating: number; // 1-5
  count: number; // yorum sayısı
  id?: string; // tripadvisor location id
  url?: string;
  fetchedAt?: string;
}

/**
 * Google'dan YALNIZCA Place ID saklanır (Google şartları başka içeriğin kalıcı saklanmasını kısıtlar).
 * Puan/yorum sayısı/saatler kullanıcı istediğinde canlı çekilir ve asla diske yazılmaz.
 */
export interface GoogleRef {
  id: string;
}

export interface Place {
  id: string;
  city: string;
  name: string;
  cat: Category;
  food?: FoodType;
  district: string;
  lat: number;
  lng: number;
  price: 1 | 2 | 3 | 4; // 1 = ucuz
  vibes: Vibe[];
  /** "Neden iyi?" — kısa, somut gerekçeler */
  why: string[];
  mustTry?: string[];
  bestTime: string;
  /** önerilen ziyaret süresi (dk) */
  dur: number;
  /** editoryal puan 0-10 (harici veri yokken ya da onu dengelemek için) */
  ed: number;
  /** zamanı güneşe bağlı deneyim: gündoğumu (otomatik plana girmez, elle eklenir) ya da gün batımı (kendi diliminde planlanır) */
  when?: "sunrise" | "sunset";
  /** çalışma saatleri (ingest ile gelir; açık alanlar için "24/7") */
  hours?: Hours;
  google?: GoogleRef;
  tripadvisor?: SourceSignal;
}

export interface City {
  slug: string;
  name: string;
  region: string;
  tagline: string;
  intro: string;
  signatureDishes: string[];
  lat: number;
  lng: number;
  places: Place[];
}

export interface ScoredPlace extends Place {
  score: number; // 0-10
}

export interface PlanStop {
  placeId: string;
  /** otomatik planda atanan zaman dilimi (kahvaltı, öğle, akşam…) */
  slot?: string;
}
export interface PlanDay {
  stops: PlanStop[];
  /** gezi günü (0 = Pazar); seçilirse çalışma saatleri kontrol edilir */
  dow?: number;
}
export interface Plan {
  days: PlanDay[];
}

/** Şehir + puanlanmış mekânlar (sunucu ya da paket tarafından yüklenir) */
export type CityData = Omit<City, "places"> & { places: ScoredPlace[] };
