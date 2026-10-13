/// <reference types="@types/google.maps" />
"use client";
import { useEffect, useRef, useState } from "react";
import { fitKey, pinElement, popupContent, type MapProps } from "./shared";

const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
/** Gelişmiş işaretçiler Map ID ister; "DEMO_MAP_ID" yalnızca geliştirme içindir — üretimde kendi Map ID'ni tanımla. */
const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID || "DEMO_MAP_ID";

let loading: Promise<void> | null = null;
/** Google Maps JS API'sini bir kez yükler (bağımlılık eklemeden, resmi dinamik yükleme yöntemiyle). */
function loadGoogle(): Promise<void> {
  if (typeof google !== "undefined" && typeof google.maps?.importLibrary === "function") return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(KEY)}&v=weekly&loading=async&language=tr&region=TR`;
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

export default function GoogleMap({ places, center, route, inPlan, dim, onToggle, height = "70vh" }: MapProps) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const info = useRef<google.maps.InfoWindow | null>(null);
  const overlays = useRef<{ markers: google.maps.marker.AdvancedMarkerElement[]; line?: google.maps.Polyline }>({ markers: [] });
  const fitted = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadGoogle();
        const { Map, InfoWindow } = (await google.maps.importLibrary("maps")) as google.maps.MapsLibrary;
        await google.maps.importLibrary("marker");
        if (cancelled || !host.current) return;
        map.current = new Map(host.current, {
          center: { lat: center[0], lng: center[1] },
          zoom: 12,
          mapId: MAP_ID,
          clickableIcons: false,
          streetViewControl: false,
          mapTypeControl: false,
        });
        info.current = new InfoWindow();
        setReady(true);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    for (const mk of overlays.current.markers) mk.map = null;
    overlays.current.line?.setMap(null);
    overlays.current = { markers: [] };

    const order = new Map((route ?? []).map((p, i) => [p.id, i + 1]));
    const bounds = new google.maps.LatLngBounds();
    const path: google.maps.LatLngLiteral[] = [];
    for (const p of route ?? places) {
      const pos = { lat: p.lat, lng: p.lng };
      const planned = inPlan?.(p.id);
      const marker = new google.maps.marker.AdvancedMarkerElement({
        map: m,
        position: pos,
        title: p.name,
        content: pinElement(p, { n: order.get(p.id), planned, dim: dim?.(p.id) }),
      });
      marker.addListener("click", () => {
        info.current?.setContent(popupContent(p, planned, onToggle && (() => { onToggle(p.id); info.current?.close(); })));
        info.current?.open({ map: m, anchor: marker });
      });
      overlays.current.markers.push(marker);
      bounds.extend(pos);
      path.push(pos);
    }
    if (route && route.length > 1) {
      overlays.current.line = new google.maps.Polyline({
        map: m,
        path,
        strokeOpacity: 0,
        icons: [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 1, strokeColor: "#c2410c", scale: 3 }, offset: "0", repeat: "14px" }],
      });
    }
    const key = fitKey(places, route);
    if (path.length && fitted.current !== key) {
      fitted.current = key;
      m.fitBounds(bounds, 48);
      google.maps.event.addListenerOnce(m, "idle", () => (m.getZoom() ?? 0) > 15 && m.setZoom(15));
    }
  }, [ready, places, route, inPlan, dim, onToggle]);

  if (error) {
    return (
      <div style={{ height }} className="rounded-2xl border border-stone-200 bg-stone-50 grid place-items-center text-sm text-stone-600 p-4 text-center">
        Harita yüklenemedi. Bağlantını ya da Google Maps anahtarı kısıtlarını (izinli alan adı) kontrol et.
      </div>
    );
  }
  return <div ref={host} style={{ height }} className="rounded-2xl border border-stone-200 z-0 bg-stone-100" />;
}
