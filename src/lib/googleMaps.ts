/// <reference types="@types/google.maps" />
"use client";

export const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

let loading: Promise<void> | null = null;
/** Google Maps JS API'sini bir kez yükler (bağımlılık eklemeden, resmi dinamik yükleme yöntemiyle). */
export function loadGoogle(): Promise<void> {
  if (typeof google !== "undefined" && typeof google.maps?.importLibrary === "function") return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_KEY)}&v=weekly&loading=async&language=tr&region=TR`;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      reject(new Error("Google Haritalar yüklenemedi"));
    };
    document.head.appendChild(s);
  });
  return loading;
}
