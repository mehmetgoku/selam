"use client";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";
import { fitKey, pinElement, popupContent, type MapProps } from "./shared";

/** Yedek harita (OpenStreetMap): yalnızca Google Maps anahtarı yokken (geliştirme/test). Google verisi gösteren üretim yapısında kullanılmamalı. */
export default function LeafletMap({ places, center, route, inPlan, dim, onToggle, height = "70vh" }: MapProps) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  /** yalnızca mekân listesi değişince haritayı yeniden sığdır; plana ekleyince zoom sıfırlanmasın */
  const fitted = useRef<string | null>(null);

  useEffect(() => {
    if (!host.current || map.current) return;
    map.current = L.map(host.current).setView(center, 12);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => {
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = map.current;
    const g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    const order = new Map((route ?? []).map((p, i) => [p.id, i + 1]));
    const pts: L.LatLngExpression[] = [];
    for (const p of route ?? places) {
      const n = order.get(p.id);
      const planned = inPlan?.(p.id);
      const icon = L.divIcon({
        className: "",
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        html: pinElement(p, { n, planned, dim: dim?.(p.id) }),
      });
      const marker = L.marker([p.lat, p.lng], { icon, title: p.name }).addTo(g);
      marker.bindPopup(() => popupContent(p, planned, onToggle && (() => { onToggle(p.id); marker.closePopup(); })));
      pts.push([p.lat, p.lng]);
    }
    if (route && route.length > 1) L.polyline(pts, { color: "#c2410c", weight: 3, dashArray: "6 6" }).addTo(g);
    const key = fitKey(places, route);
    if (pts.length && fitted.current !== key) {
      fitted.current = key;
      m.fitBounds(L.latLngBounds(pts).pad(0.2), { maxZoom: 15 });
    }
  }, [places, route, inPlan, dim, onToggle]);

  return <div ref={host} style={{ height }} className="rounded-2xl border border-stone-200 z-0" />;
}
