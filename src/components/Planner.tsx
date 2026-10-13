"use client";
import { useEffect, useMemo, useState } from "react";
import { CATEGORIES, PRICE_LABEL } from "@/lib/categories";
import { haversineKm, mapsUrl } from "@/lib/geo";
import { checkVisit, DAY_NAMES } from "@/lib/hours";
import { fmtTime, generatePlan, scheduleDay, type Pace, type PlanPrefs } from "@/lib/itinerary";
import { MapView } from "./MapLoader";
import type { Op } from "@/lib/collab";
import { decodePlan, encodePlan, shareText } from "@/lib/sharePlan";
import { usePlan } from "@/lib/usePlan";
import { useRoom } from "@/lib/useRoom";
import type { Category, Plan, ScoredPlace } from "@/lib/types";

export function Planner({ slug, cityName, places, center }: { slug: string; cityName: string; places: ScoredPlace[]; center: [number, number] }) {
  const [shared, setShared] = useState<Plan | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [mapDay, setMapDay] = useState<number | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const local = usePlan(slug);
  const room = useRoom(roomId, places);
  const plan = roomId ? room.state.plan : local.plan;
  const ready = roomId ? room.status !== "idle" && room.status !== "loading" : local.ready;
  const byId = new Map(places.map((p) => [p.id, p]));
  const localCtx = useMemo(() => ({ validIds: new Set(places.map((p) => p.id)), nameOf: (id: string) => byId.get(id)?.name ?? id }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [places]);
  /** Yerel plan ya da ortak oda: ikisi de aynı işlem kümesiyle düzenlenir. */
  const dispatch = (op: Op) => (roomId ? room.dispatch(op) : local.dispatch(op, localCtx));
  const [prefs, setPrefs] = useState<PlanPrefs>({
    days: 2,
    pace: "normal",
    interests: ["kultur", "doga", "eglence", "pub", "alisveris"],
    vibes: [],
    maxPrice: 4,
    startDow: null,
  });
  const [adding, setAdding] = useState<number | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const oda = q.get("oda");
    if (oda && /^[A-Za-z0-9_-]{12}$/.test(oda)) setRoomId(oda);
    const raw = q.get("p");
    if (raw) setShared(decodePlan(raw, new Set(places.map((p) => p.id))));
  }, [places]);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };
  const shareUrl = () => `${window.location.origin}${window.location.pathname}?p=${encodeURIComponent(encodePlan(plan))}`;
  const doShare = async () => {
    const url = shareUrl();
    try {
      if (navigator.share) {
        await navigator.share({ title: `${cityName} gezi planım`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      flash("Bağlantı kopyalandı");
    } catch {
      flash("Kopyalanamadı — adres çubuğundaki bağlantıyı kullan");
      window.history.replaceState(null, "", url);
    }
  };
  const whatsappHref = () => {
    const days = plan.days
      .filter((d) => d.stops.length)
      .map((day, i) => ({
        label: `${i + 1}. Gün${day.dow !== undefined ? ` · ${DAY_NAMES[day.dow]}` : ""}`,
        lines: scheduleDay(
          day.stops.flatMap((st) => {
            const place = byId.get(st.placeId);
            return place ? [{ place, slot: st.slot }] : [];
          }),
        ).map((t) => `${fmtTime(t.start)} ${t.place.name}`),
      }));
    return `https://wa.me/?text=${encodeURIComponent(shareText(cityName, days, shareUrl()))}`;
  };
  const adoptShared = () => {
    if (!shared) return;
    const hasOwn = plan.days.some((d) => d.stops.length);
    if (hasOwn && !window.confirm(roomId ? "Ortak plan, paylaşılan planla DEĞİŞTİRİLECEK (herkes görür). Devam edilsin mi?" : "Mevcut planın silinip paylaşılan planla değiştirilecek. Devam edilsin mi?")) return;
    dispatch({ t: "replace", plan: shared });
    setShared(null);
    window.history.replaceState(null, "", window.location.pathname + (roomId ? `?oda=${roomId}` : ""));
  };

  const toggleInterest = (c: Category) =>
    setPrefs((p) => ({
      ...p,
      interests: p.interests.includes(c) ? p.interests.filter((x) => x !== c) : [...p.interests, c],
    }));

  const auto = () => {
    if (roomId && plan.days.some((d) => d.stops.length) && !window.confirm("Ortak plan baştan oluşturulacak ve herkesin planı değişecek. Devam edilsin mi?")) return;
    dispatch({ t: "replace", plan: generatePlan(places, prefs) });
  };

  const move = (id: string, dir: -1 | 1) => dispatch({ t: "move", placeId: id, dir });
  const removeStop = (id: string) => dispatch({ t: "remove", placeId: id });
  const addTo = (d: number, id: string) => dispatch({ t: "add", placeId: id, day: d });
  const setDow = (d: number, dow: number | undefined) => dispatch({ t: "dow", day: d, dow });
  const addDay = () => dispatch({ t: "addDay" });

  const startRoom = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city: slug, plan: local.plan.days.some((d) => d.stops.length) ? local.plan : undefined }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      window.history.pushState(null, "", `${window.location.pathname}?oda=${body.id}`);
      setRoomId(body.id);
    } catch (e) {
      flash(`Oda açılamadı: ${(e as Error).message || "bağlantı hatası"}`);
    } finally {
      setCreating(false);
    }
  };
  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?oda=${roomId}`);
      flash("Davet bağlantısı kopyalandı");
    } catch {
      flash("Kopyalanamadı — adres çubuğundaki bağlantıyı gönder");
    }
  };

  const planned = new Set(plan.days.flatMap((d) => d.stops.map((s) => s.placeId)));

  return (
    <div className="space-y-6">
      {!roomId && (
        <section className="rounded-2xl bg-white border border-stone-200 p-4 flex flex-wrap items-center gap-3">
          <div className="mr-auto">
            <h2 className="font-bold">👥 Arkadaşlarla birlikte planla</h2>
            <p className="text-xs text-stone-500">Ortak bir oda aç: herkes aynı planı canlı düzenler, mekânlara oy verir.</p>
          </div>
          <button
            onClick={startRoom}
            disabled={creating}
            className="rounded-full bg-ink text-white px-4 py-1.5 text-sm font-semibold disabled:opacity-50"
          >
            {creating ? "Açılıyor…" : "Ortak oda aç"}
          </button>
        </section>
      )}
      {roomId && (
        <section className="rounded-2xl bg-brand-soft border border-brand/30 p-4 space-y-3">
          {room.status === "notfound" ? (
            <p className="font-semibold">Bu oda bulunamadı ya da süresi dolmuş. Bağlantıyı kontrol et.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="font-bold mr-auto">
                  👥 Ortak plan{" "}
                  <span className={`text-xs font-semibold ${room.status === "live" ? "text-green-700" : "text-red-700"}`}>
                    {room.status === "live" ? "● canlı" : room.status === "offline" ? "● bağlantı yok" : "● bağlanıyor"}
                  </span>
                </h2>
                <div className="flex -space-x-2" aria-label="Odadakiler">
                  {room.participants.map((p) => (
                    <span
                      key={p.cid}
                      title={p.cid === room.me.cid ? `${p.name} (sen)` : p.name}
                      className="w-8 h-8 rounded-full border-2 border-white grid place-items-center text-xs font-bold text-white"
                      style={{ background: `hsl(${[...p.cid].reduce((h, c) => h + c.charCodeAt(0) * 7, 0) % 360} 55% 40%)` }}
                    >
                      {p.name.slice(0, 1).toLocaleUpperCase("tr")}
                    </span>
                  ))}
                </div>
                <button onClick={copyInvite} className="rounded-full bg-brand text-white px-4 py-1.5 text-sm font-semibold">
                  Davet bağlantısını kopyala
                </button>
              </div>
              {room.me.cid && !room.me.name ? (
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const v = new FormData(e.currentTarget).get("ad");
                    if (typeof v === "string" && v.trim()) room.setName(v);
                  }}
                >
                  <input
                    name="ad"
                    maxLength={24}
                    placeholder="Adın (arkadaşların görecek)"
                    className="flex-1 rounded-lg border border-stone-300 px-3 py-1.5 text-sm"
                    autoFocus
                  />
                  <button className="rounded-full bg-ink text-white px-4 py-1.5 text-sm font-semibold">Katıl</button>
                </form>
              ) : (
                <p className="text-xs text-stone-600">
                  Sen: <strong>{room.me.name || "…"}</strong> ·{" "}
                  <button className="underline" onClick={() => { const n = window.prompt("Yeni adın", room.me.name); if (n?.trim()) room.setName(n); }}>
                    değiştir
                  </button>
                  . Bağlantıya sahip herkes planı düzenleyebilir — bağlantıyı yalnızca güvendiğin kişilerle paylaş.
                </p>
              )}
              {room.error && (
                <p role="alert" className="text-sm text-red-700 bg-red-50 rounded px-3 py-1.5">
                  {room.error} <button className="underline" onClick={room.clearError}>kapat</button>
                </p>
              )}
            </>
          )}
        </section>
      )}
      {shared && (
        <section className="rounded-2xl bg-brand-soft border border-brand/30 p-4 space-y-2">
          <h2 className="font-bold">🔗 Sana bir plan paylaşıldı</h2>
          <p className="text-sm text-stone-700">
            {shared.days.length} gün · {shared.days.reduce((n, d) => n + d.stops.length, 0)} durak:{" "}
            {shared.days.flatMap((d) => d.stops).slice(0, 4).map((st) => byId.get(st.placeId)?.name).join(", ")}…
          </p>
          <div className="flex gap-2">
            <button onClick={adoptShared} className="rounded-full bg-brand text-white px-4 py-1.5 text-sm font-semibold">
              Bu planı kullan
            </button>
            <button onClick={() => setShared(null)} className="rounded-full border border-stone-300 bg-white px-4 py-1.5 text-sm">
              Kapat
            </button>
          </div>
        </section>
      )}
      <section className="rounded-2xl bg-white border border-stone-200 p-4 space-y-4">
        <h2 className="font-bold">⚡ Otomatik plan oluştur</h2>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            Gün
            <input
              type="number" min={1} max={7} value={prefs.days}
              onChange={(e) => setPrefs({ ...prefs, days: Math.min(7, Math.max(1, Number(e.target.value) || 1)) })}
              className="w-16 rounded-lg border border-stone-300 px-2 py-1"
            />
          </label>
          <label className="flex items-center gap-2">
            Tempo
            <select
              value={prefs.pace}
              onChange={(e) => setPrefs({ ...prefs, pace: e.target.value as Pace })}
              className="rounded-lg border border-stone-300 px-2 py-1"
            >
              <option value="rahat">Rahat (4 durak)</option>
              <option value="normal">Normal (5-6 durak)</option>
              <option value="yogun">Yoğun (7 durak)</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            Başlangıç günü
            <select
              value={prefs.startDow ?? ""}
              onChange={(e) => setPrefs({ ...prefs, startDow: e.target.value === "" ? null : Number(e.target.value) })}
              className="rounded-lg border border-stone-300 px-2 py-1"
            >
              <option value="">Seçme (saatleri kontrol etme)</option>
              {[1, 2, 3, 4, 5, 6, 0].map((n) => (
                <option key={n} value={n}>{DAY_NAMES[n]}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            Bütçe
            <select
              value={prefs.maxPrice}
              onChange={(e) => setPrefs({ ...prefs, maxPrice: Number(e.target.value) as PlanPrefs["maxPrice"] })}
              className="rounded-lg border border-stone-300 px-2 py-1"
            >
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>{n === 4 ? "Sınırsız" : `En fazla ${PRICE_LABEL[n]}`}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.filter((c) => c.id !== "yemek").map((c) => (
            <button
              key={c.id}
              onClick={() => toggleInterest(c.id)}
              className={`rounded-full border px-3 py-1 text-sm ${
                prefs.interests.includes(c.id) ? "bg-ink text-white border-ink" : "bg-white border-stone-300"
              }`}
            >
              {c.emoji} {c.label}
            </button>
          ))}
        </div>
        <button onClick={auto} className="rounded-full bg-brand text-white px-5 py-2 font-semibold">
          Planı oluştur
        </button>
        <p className="text-xs text-stone-500">
          Her gün için en yüksek puanlı gezilecek yer seçilir; yemek, kahve ve gece durakları puan + yakınlığa göre
          eklenir. Sonra elle düzenleyebilirsin.
        </p>
      </section>

      {!ready ? null : plan.days.map((day, d) => {
        const timed = scheduleDay(
          day.stops.flatMap((s) => {
            const place = byId.get(s.placeId);
            return place ? [{ place, slot: s.slot }] : [];
          }),
        );
        const km = timed.reduce((n, s, i) => n + (i ? haversineKm(timed[i - 1].place, s.place) : 0), 0);
        return (
          <section key={d} className="rounded-2xl bg-white border border-stone-200 p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg">
                {d + 1}. Gün
                <select
                  aria-label="Hafta günü"
                  value={day.dow ?? ""}
                  onChange={(e) => setDow(d, e.target.value === "" ? undefined : Number(e.target.value))}
                  className="ml-2 rounded-lg border border-stone-300 px-1.5 py-0.5 text-sm font-normal"
                >
                  <option value="">Gün seç → saat kontrolü</option>
                  {[1, 2, 3, 4, 5, 6, 0].map((n) => (
                    <option key={n} value={n}>{DAY_NAMES[n]}</option>
                  ))}
                </select>
              </h2>
              <span className="text-xs text-stone-500">
                {timed.length > 0 && (
                  <button className="text-brand font-semibold mr-2" onClick={() => setMapDay(mapDay === d ? null : d)}>
                    {mapDay === d ? "Haritayı gizle" : "🗺️ Haritada gör"}
                  </button>
                )}
                {timed.length} durak · ~{km.toFixed(1)} km{timed.length ? ` · ${fmtTime(timed[0].start)}–${fmtTime(timed[timed.length - 1].end)}` : ""}
              </span>
            </div>
            {mapDay === d && timed.length > 0 && (
              <div className="mt-3">
                <MapView places={[]} route={timed.map((t) => t.place)} center={center} height="50vh" />
              </div>
            )}
            {timed.length === 0 && <p className="text-sm text-stone-500 py-3">Henüz durak yok.</p>}
            <ol className="mt-3 space-y-3">
              {timed.map((s, i) => (
                <li key={s.place.id} className="flex gap-3">
                  <div className="w-14 shrink-0 text-sm font-mono text-stone-500">
                    {fmtTime(s.start)}
                    {s.travelFromPrev > 0 && <div className="text-[10px]">🚶 {s.travelFromPrev} dk</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold">
                      {s.place.name} <span className="text-xs font-normal text-stone-500">{s.slot ?? ""}</span>
                    </p>
                    {(() => {
                      if (day.dow === undefined) return null;
                      const v = checkVisit(s.place.hours, day.dow, s.start, s.end);
                      return v.detail ? (
                        <p className="text-xs font-semibold text-red-700 bg-red-50 rounded px-2 py-1 my-1 inline-block">⚠ {v.detail}</p>
                      ) : null;
                    })()}
                    <p className="text-sm text-stone-600">{s.place.why[0]}</p>
                    {roomId && (() => {
                      const v = room.state.votes[s.place.id] ?? {};
                      const mine = room.me.cid in v;
                      return (
                        <button
                          onClick={() => dispatch({ t: "vote", placeId: s.place.id })}
                          title={Object.values(v).join(", ") || "İlk oyu sen ver"}
                          aria-pressed={mine}
                          className={`mt-1 mr-2 rounded-full border px-2 py-0.5 text-xs ${mine ? "bg-brand text-white border-brand" : "bg-white border-stone-300"}`}
                        >
                          👍 {Object.keys(v).length || ""} {Object.keys(v).length > 0 && <span className="opacity-80">{Object.values(v).slice(0, 2).join(", ")}{Object.keys(v).length > 2 ? "…" : ""}</span>}
                        </button>
                      );
                    })()}
                    <p className="text-xs text-stone-500 mt-1">
                      ~{s.place.dur} dk · {s.place.district} ·{" "}
                      <a className="underline" href={mapsUrl(s.place)} target="_blank" rel="noopener noreferrer">Harita</a>
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 text-xs">
                    <button aria-label="Yukarı" onClick={() => move(s.place.id, -1)} disabled={i === 0} className="disabled:opacity-30">▲</button>
                    <button aria-label="Aşağı" onClick={() => move(s.place.id, 1)} disabled={i === timed.length - 1} className="disabled:opacity-30">▼</button>
                    <button aria-label="Kaldır" onClick={() => removeStop(s.place.id)}>✕</button>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-3">
              {adding === d ? (
                <select
                  autoFocus
                  defaultValue=""
                  onChange={(e) => { if (e.target.value) addTo(d, e.target.value); setAdding(null); }}
                  onBlur={() => setAdding(null)}
                  className="w-full rounded-lg border border-stone-300 px-2 py-2 text-sm"
                >
                  <option value="">Mekân seç…</option>
                  {places.filter((p) => !planned.has(p.id)).map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.score.toFixed(1)})</option>
                  ))}
                </select>
              ) : (
                <button onClick={() => setAdding(d)} className="text-sm text-brand font-semibold">+ Durak ekle</button>
              )}
            </div>
          </section>
        );
      })}
      {ready && plan.days.some((d) => d.stops.length) && (
        <section className="rounded-2xl bg-white border border-stone-200 p-4 flex flex-wrap items-center gap-3">
          <h2 className="font-bold mr-auto">Planı paylaş</h2>
          <button onClick={doShare} className="rounded-full bg-brand text-white px-4 py-1.5 text-sm font-semibold">
            🔗 Bağlantıyı paylaş / kopyala
          </button>
          <a
            href={whatsappHref()}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-stone-300 px-4 py-1.5 text-sm font-semibold hover:border-ink"
          >
            WhatsApp
          </a>
          <p className="basis-full text-xs text-stone-500">
            Bağlantı planın o anki halini içerir (sunucuda saklanmaz); sonradan yaptığın değişiklikler için yeniden paylaş.
          </p>
        </section>
      )}
      {roomId && room.log.length > 0 && (
        <section className="rounded-2xl bg-white border border-stone-200 p-4">
          <h2 className="font-bold mb-2">Son hareketler</h2>
          <ul className="space-y-1 text-sm text-stone-700">
            {[...room.log].reverse().slice(0, 8).map((l) => (
              <li key={l.t + l.text}>
                <strong>{l.by}</strong> · {l.text}
              </li>
            ))}
          </ul>
        </section>
      )}
      {toast && (
        <div role="status" className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-ink text-white px-4 py-2 text-sm shadow-lg">
          {toast}
        </div>
      )}
      {ready && (
        <button onClick={addDay} className="text-sm text-brand font-semibold">+ Gün ekle</button>
      )}
    </div>
  );
}
