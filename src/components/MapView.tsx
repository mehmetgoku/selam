"use client";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";
import { catEmoji, PRICE_LABEL } from "@/lib/categories";
import { mapsUrl } from "@/lib/geo";
import type { ScoredPlace } from "@/lib/types";

interface Props {
  places: ScoredPlace[];
  center: [number, number];
  /** verilirse noktalar bu sırayla numaralanır ve rota çizgisiyle birleştirilir */
  route?: ScoredPlace[];
  inPlan?: (id: string) => boolean;
  onToggle?: (id: string) => void;
  height?: string;
}

function popup(p: ScoredPlace, inPlan: boolean | undefined, onToggle?: () => void) {
  const el = document.createElement("div");
  el.style.minWidth = "200px";
  const add = (tag: string, text: string, style = "") => {
    const n = document.createElement(tag);
    n.textContent = text;
    n.style.cssText = style;
    el.appendChild(n);
    return n;
  };
  add("strong", p.name, "display:block");
  add("div", `${p.district} · ${PRICE_LABEL[p.price]} · skor ${p.score.toFixed(1)}`, "font-size:12px;color:#78716c");
  add("div", p.why[0], "font-size:12px;margin:6px 0");
  const row = document.createElement("div");
  row.style.cssText = "display:flex;gap:8px;align-items:center";
  const a = document.createElement("a");
  a.href = mapsUrl(p);
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.textContent = "Google Maps";
  a.style.fontSize = "12px";
  row.appendChild(a);
  if (onToggle) {
    const b = document.createElement("button");
    b.textContent = inPlan ? "Plandan çıkar" : "+ Plana ekle";
    b.style.cssText = "background:#c2410c;color:#fff;border-radius:999px;padding:4px 10px;font-size:12px";
    b.onclick = onToggle;
    row.appendChild(b);
  }
  el.appendChild(row);
  return el;
}

export default function MapView({ places, center, route, inPlan, onToggle, height = "70vh" }: Props) {
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
        html: `<div style="width:30px;height:30px;border-radius:50%;display:grid;place-items:center;font-size:${n ? 13 : 15}px;font-weight:700;color:#fff;border:2px solid #fff;box-shadow:0 1px 4px #0006;background:${
          n || planned ? "#c2410c" : "#1c1917"
        }">${n ?? catEmoji(p.cat)}</div>`,
      });
      const marker = L.marker([p.lat, p.lng], { icon, title: p.name }).addTo(g);
      marker.bindPopup(() => popup(p, planned, onToggle && (() => { onToggle(p.id); marker.closePopup(); })));
      pts.push([p.lat, p.lng]);
    }
    if (route && route.length > 1) L.polyline(pts, { color: "#c2410c", weight: 3, dashArray: "6 6" }).addTo(g);
    const key = (route ?? places).map((p) => p.id).join(",");
    if (pts.length && fitted.current !== key) {
      fitted.current = key;
      m.fitBounds(L.latLngBounds(pts).pad(0.2), { maxZoom: 15 });
    }
  }, [places, route, inPlan, onToggle]);

  return <div ref={host} style={{ height }} className="rounded-2xl border border-stone-200 z-0" />;
}
