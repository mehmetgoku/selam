"use client";
import dynamic from "next/dynamic";

/**
 * Google Maps anahtarı (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) varsa Google Haritalar; yoksa yedek olarak Leaflet/OSM.
 * İkisi de yalnızca istemcide, ihtiyaç olunca yüklenir (Leaflet CSS'i Google modunda hiç yüklenmez).
 */
const useGoogle = !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export const MapView = dynamic(() => (useGoogle ? import("./map/GoogleMap") : import("./map/LeafletMap")), {
  ssr: false,
  loading: () => <div className="h-[70vh] rounded-2xl bg-stone-100 animate-pulse" />,
});
