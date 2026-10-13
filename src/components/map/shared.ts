import { catEmoji, PRICE_LABEL } from "@/lib/categories";
import { mapsUrl } from "@/lib/geo";
import type { ScoredPlace } from "@/lib/types";

export interface MapProps {
  places: ScoredPlace[];
  center: [number, number];
  /** verilirse noktalar bu sırayla numaralanır ve rota çizgisiyle birleştirilir */
  route?: ScoredPlace[];
  inPlan?: (id: string) => boolean;
  /** true dönen mekânlar (ör. şu an kapalı) soluk çizilir */
  dim?: (id: string) => boolean;
  onToggle?: (id: string) => void;
  height?: string;
}

/** Her iki harita sağlayıcısı için ortak işaretçi (numaralı/emojili daire). DOM ile kurulur, innerHTML yok. */
export function pinElement(p: ScoredPlace, opts: { n?: number; planned?: boolean; dim?: boolean }) {
  const el = document.createElement("div");
  const hot = !!opts.n || !!opts.planned;
  el.style.cssText = `width:30px;height:30px;border-radius:50%;display:grid;place-items:center;font-size:${
    opts.n ? 13 : 15
  }px;font-weight:700;color:#fff;border:2px solid #fff;box-shadow:0 1px 4px #0006;opacity:${opts.dim ? 0.4 : 1};background:${
    hot ? "#c2410c" : "#1c1917"
  };cursor:pointer`;
  el.textContent = String(opts.n ?? catEmoji(p.cat));
  el.title = p.name;
  return el;
}

/** Bilgi balonu içeriği. Kasıtlı olarak yalnızca Selam skoru + editoryal metin gösterir (ham Google puanı/saati yok). */
export function popupContent(p: ScoredPlace, inPlan: boolean | undefined, onToggle?: () => void) {
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

/** Aynı mekân kümesi/rotası için tekrar sığdırmayı önlemek (plana ekleyince zoom sıfırlanmasın). */
export const fitKey = (places: ScoredPlace[], route?: ScoredPlace[]) => (route ?? places).map((p) => p.id).join(",");
