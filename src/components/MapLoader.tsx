"use client";
import dynamic from "next/dynamic";

/** Leaflet `window` ister; yalnızca istemcide yüklenir. */
export const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <div className="h-[70vh] rounded-2xl bg-stone-100 animate-pulse" />,
});
