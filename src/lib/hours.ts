/**
 * Çalışma saatleri. Google Places `regularOpeningHours.periods` biçimini (gün 0 = Pazar) sadeleştirir.
 * Saat bilgisi yoksa mekân "bilinmiyor" sayılır — tahmin yürütülmez.
 */
export interface Period {
  day: number; // 0-6, 0 = Pazar
  open: number; // gün içi dakika
  close: number;
  closeDay: number;
}
/** "24/7": kapısı/saati olmayan açık alanlar (sahil, köprü, cadde) */
export type Hours = "24/7" | Period[];

export const DAY_NAMES = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
const DAY = 1440;
const WEEK = 7 * DAY;

export interface Now {
  dow: number;
  minute: number;
}

/** Türkiye UTC+3 sabit (yaz saati yok) — kullanıcının saat dilimi ne olursa olsun mekân saatiyle kıyaslanır. */
export function istanbulNow(d = new Date()): Now {
  const t = new Date(d.getTime() + 3 * 3600_000);
  return { dow: t.getUTCDay(), minute: t.getUTCHours() * 60 + t.getUTCMinutes() };
}

export const fmtClock = (minute: number) => {
  const m = ((minute % DAY) + DAY) % DAY;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

export type OpenStatus =
  | { state: "unknown" }
  | { state: "always" }
  | { state: "open"; minutesLeft: number; closesAt: Now }
  | { state: "closed"; opensAt: Now };

const at = (t: number): Now => ({ dow: Math.floor((t % WEEK) / DAY), minute: t % DAY });

export function openStatus(hours: Hours | undefined, now: Now): OpenStatus {
  if (!hours || (hours !== "24/7" && hours.length === 0)) return { state: "unknown" };
  if (hours === "24/7") return { state: "always" };
  const t = now.dow * DAY + now.minute;
  const spans = hours.map((p) => {
    const s = p.day * DAY + p.open;
    let e = p.closeDay * DAY + p.close;
    if (e <= s) e += WEEK;
    return [s, e] as const;
  });
  for (const [s, e] of spans) {
    for (const tt of [t, t + WEEK]) {
      if (tt >= s && tt < e) return { state: "open", minutesLeft: e - tt, closesAt: at(t + (e - tt)) };
    }
  }
  const wait = Math.min(...spans.map(([s]) => (((s - t) % WEEK) + WEEK) % WEEK));
  return { state: "closed", opensAt: at(t + wait) };
}

export function statusText(st: OpenStatus, now: Now): string | null {
  switch (st.state) {
    case "unknown":
      return null;
    case "always":
      return "Açık alan · her zaman erişilebilir";
    case "open":
      return st.minutesLeft <= 60
        ? `Yakında kapanıyor · ${fmtClock(st.closesAt.minute)}`
        : `Şimdi açık · kapanış ${fmtClock(st.closesAt.minute)}`;
    case "closed": {
      const day = st.opensAt.dow === now.dow && st.opensAt.minute > now.minute ? "" : `${DAY_NAMES[st.opensAt.dow]} `;
      return `Kapalı · açılış ${day}${fmtClock(st.opensAt.minute)}`;
    }
  }
}

export type VisitCheck = { state: "ok" | "unknown" | "closed" | "closing"; detail?: string };

/** Belirli bir günde [start, end) dakikaları arasında ziyaret mümkün mü? (start gece yarısını aşabilir) */
export function checkVisit(hours: Hours | undefined, dow: number, start: number, end: number): VisitCheck {
  const st = openStatus(hours, { dow: (dow + Math.floor(start / DAY)) % 7, minute: start % DAY });
  if (st.state === "unknown") return { state: "unknown" };
  if (st.state === "always") return { state: "ok" };
  if (st.state === "closed") {
    return { state: "closed", detail: `Kapalı olabilir · açılış ${DAY_NAMES[st.opensAt.dow]} ${fmtClock(st.opensAt.minute)}` };
  }
  if (st.minutesLeft < Math.min(end - start, 30)) {
    return { state: "closing", detail: `${fmtClock(st.closesAt.minute)}'de kapanıyor, ziyaret yetişmeyebilir` };
  }
  return { state: "ok" };
}

/**
 * Google Places `regularOpeningHours.periods` → sade Hours (canlı çekilen veriden; asla saklanmaz).
 * Kapanışsız tek dönem = 7/24. Boş/bilinmiyorsa undefined.
 */
export function periodsToHours(
  periods?: { open?: { day: number; hour: number; minute?: number }; close?: { day: number; hour: number; minute?: number } | null }[] | null,
): Hours | undefined {
  if (!periods?.length) return undefined;
  if (periods.length === 1 && periods[0].open && !periods[0].close) return "24/7";
  const out: Period[] = [];
  for (const p of periods) {
    if (!p.open || !p.close) continue;
    out.push({
      day: p.open.day,
      open: p.open.hour * 60 + (p.open.minute ?? 0),
      close: p.close.hour * 60 + (p.close.minute ?? 0),
      closeDay: p.close.day,
    });
  }
  return out.length ? out : undefined;
}
