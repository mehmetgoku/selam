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

export interface SourceSignal {
  rating: number; // 1-5
  count: number; // yorum sayısı
  id?: string; // google place id / tripadvisor location id
  url?: string;
  fetchedAt?: string;
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
  /** çalışma saatleri (ingest ile gelir; açık alanlar için "24/7") */
  hours?: Hours;
  google?: SourceSignal;
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
  /** 0-1: yorumlar yerel mi turist mi ağırlıklı (iki kaynak varsa) */
  localness?: number;
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
