import type { Category, FoodType, Vibe } from "./types";

export const CATEGORIES: { id: Category; label: string; emoji: string }[] = [
  { id: "yemek", label: "Yemek", emoji: "🍽️" },
  { id: "kultur", label: "Kültür & Tarih", emoji: "🏛️" },
  { id: "doga", label: "Doğa & Manzara", emoji: "🌿" },
  { id: "eglence", label: "Eğlence & Deneyim", emoji: "🎡" },
  { id: "pub", label: "Pub & Bar", emoji: "🍻" },
  { id: "alisveris", label: "Alışveriş", emoji: "🛍️" },
];

export const FOOD_TYPES: { id: FoodType; label: string; emoji: string }[] = [
  { id: "kahvalti", label: "Kahvaltı", emoji: "🍳" },
  { id: "kebap", label: "Kebap & Izgara", emoji: "🥙" },
  { id: "pide-lahmacun", label: "Pide & Lahmacun", emoji: "🫓" },
  { id: "balik", label: "Balık", emoji: "🐟" },
  { id: "lokanta", label: "Lokanta & Ev Yemeği", emoji: "🍲" },
  { id: "sokak", label: "Sokak Lezzeti", emoji: "🌯" },
  { id: "meyhane", label: "Meyhane", emoji: "🍷" },
  { id: "tatli", label: "Tatlı", emoji: "🍯" },
  { id: "kahve", label: "Kahve", emoji: "☕" },
];

export const VIBES: { id: Vibe; label: string }[] = [
  { id: "ogrenci", label: "Öğrenci dostu" },
  { id: "butce-dostu", label: "Bütçe dostu" },
  { id: "romantik", label: "Romantik" },
  { id: "grup", label: "Arkadaş grubu" },
  { id: "gece", label: "Gece hayatı" },
  { id: "manzara", label: "Manzaralı" },
  { id: "fotograf", label: "Fotoğraflık" },
  { id: "yerel", label: "Yerel favori" },
  { id: "aile", label: "Aile" },
];

export const PRICE_LABEL = ["", "₺", "₺₺", "₺₺₺", "₺₺₺₺"];

export const catLabel = (c: Category) => CATEGORIES.find((x) => x.id === c)!.label;
export const catEmoji = (c: Category) => CATEGORIES.find((x) => x.id === c)!.emoji;
export const foodLabel = (f: FoodType) => FOOD_TYPES.find((x) => x.id === f)!.label;
export const vibeLabel = (v: Vibe) => VIBES.find((x) => x.id === v)!.label;
