import { SLOTS, type SlotId } from "./itinerary";
import { DAY_NAMES } from "./hours";
import type { Plan } from "./types";

/**
 * Ortak plan: istemciler tüm planı değil, küçük işlemler (op) gönderir; sunucu sırayla uygular.
 * İşlemler mümkün olduğunca mekân kimliğine bağlıdır (indeks değil) → eşzamanlı düzenlemelerde
 * kimsenin değişikliği ezilmez (iki kişi aynı anda farklı mekân eklerse ikisi de kalır).
 */
export const MAX_DAYS = 14;
export const MAX_STOPS = 40;

/** placeId → (cid → oy veren adı) */
export type Votes = Record<string, Record<string, string>>;
export interface RoomState {
  plan: Plan;
  votes: Votes;
}

export type Op =
  | { t: "add"; placeId: string; day: number }
  | { t: "remove"; placeId: string }
  | { t: "move"; placeId: string; dir: -1 | 1 }
  | { t: "dow"; day: number; dow?: number }
  | { t: "addDay" }
  | { t: "replace"; plan: Plan }
  | { t: "vote"; placeId: string };

export interface OpCtx {
  cid: string;
  name: string;
  validIds: Set<string>;
  nameOf: (placeId: string) => string;
}

export type OpResult = { ok: true; state: RoomState; summary: string } | { ok: false; error: string };

const ID_RE = /^[a-z0-9-]{1,40}$/;
const isId = (v: unknown, valid: Set<string>): v is string => typeof v === "string" && ID_RE.test(v) && valid.has(v);

export const emptyState = (): RoomState => ({ plan: { days: [{ stops: [] }] }, votes: {} });

export function sanitizeName(raw: unknown): string {
  if (typeof raw !== "string") return "Misafir";
  // eslint-disable-next-line no-control-regex
  const s = raw.replace(/[\u0000-\u001f\u007f<>]/g, "").trim().slice(0, 24);
  return s || "Misafir";
}

/** Güvenilmeyen plan nesnesini temizler: bilinmeyen/yinelenen mekân atılır, sınırlar uygulanır. */
export function sanitizePlan(raw: unknown, validIds: Set<string>): Plan | null {
  const days = (raw as { days?: unknown })?.days;
  if (!Array.isArray(days) || days.length === 0 || days.length > MAX_DAYS) return null;
  const seen = new Set<string>();
  const out: Plan["days"] = [];
  for (const d of days) {
    const stops: Plan["days"][number]["stops"] = [];
    const rawStops = Array.isArray(d?.stops) ? d.stops : [];
    for (const s of rawStops.slice(0, MAX_STOPS)) {
      if (!isId(s?.placeId, validIds) || seen.has(s.placeId)) continue;
      seen.add(s.placeId);
      stops.push(typeof s.slot === "string" && s.slot in SLOTS ? { placeId: s.placeId, slot: s.slot as SlotId } : { placeId: s.placeId });
    }
    const dow = d?.dow;
    out.push(Number.isInteger(dow) && dow >= 0 && dow <= 6 ? { stops, dow } : { stops });
  }
  return { days: out };
}

/** İstemciden gelen ham JSON'u Op'a çevirir; şekil geçersizse null. */
export function parseOp(raw: unknown, validIds: Set<string>): Op | null {
  const o = raw as Record<string, unknown> | null;
  if (!o || typeof o !== "object") return null;
  switch (o.t) {
    case "add":
      return isId(o.placeId, validIds) && Number.isInteger(o.day) ? { t: "add", placeId: o.placeId, day: o.day as number } : null;
    case "remove":
    case "vote":
      return isId(o.placeId, validIds) ? { t: o.t, placeId: o.placeId } : null;
    case "move":
      return isId(o.placeId, validIds) && (o.dir === 1 || o.dir === -1) ? { t: "move", placeId: o.placeId, dir: o.dir } : null;
    case "dow":
      if (!Number.isInteger(o.day)) return null;
      if (o.dow === undefined || o.dow === null) return { t: "dow", day: o.day as number };
      return Number.isInteger(o.dow) && (o.dow as number) >= 0 && (o.dow as number) <= 6
        ? { t: "dow", day: o.day as number, dow: o.dow as number }
        : null;
    case "addDay":
      return { t: "addDay" };
    case "replace": {
      const plan = sanitizePlan(o.plan, validIds);
      return plan ? { t: "replace", plan } : null;
    }
    default:
      return null;
  }
}

const locate = (plan: Plan, id: string) => {
  for (let d = 0; d < plan.days.length; d++) {
    const i = plan.days[d].stops.findIndex((s) => s.placeId === id);
    if (i >= 0) return { d, i };
  }
  return null;
};

const pruneVotes = (plan: Plan, votes: Votes): Votes => {
  const planned = new Set(plan.days.flatMap((d) => d.stops.map((s) => s.placeId)));
  return Object.fromEntries(Object.entries(votes).filter(([id]) => planned.has(id)));
};

/** Saf fonksiyon: state'i değiştirmez. Etkisiz işlem (ör. zaten silinmiş mekânı silme) summary: "" döner. */
export function applyOp(state: RoomState, op: Op, ctx: OpCtx): OpResult {
  const { plan, votes } = state;
  const noop = (): OpResult => ({ ok: true, state, summary: "" });
  switch (op.t) {
    case "add": {
      if (!ctx.validIds.has(op.placeId)) return { ok: false, error: "Bilinmeyen mekân" };
      if (locate(plan, op.placeId)) return noop();
      const day = Math.min(Math.max(op.day, 0), plan.days.length - 1);
      if (plan.days[day].stops.length >= MAX_STOPS) return { ok: false, error: "Bir güne en fazla 40 durak eklenebilir" };
      const days = plan.days.map((d, i) => (i === day ? { ...d, stops: [...d.stops, { placeId: op.placeId }] } : d));
      return { ok: true, state: { plan: { days }, votes }, summary: `➕ ${ctx.nameOf(op.placeId)} → ${day + 1}. gün` };
    }
    case "remove": {
      if (!locate(plan, op.placeId)) return noop();
      const days = plan.days.map((d) => ({ ...d, stops: d.stops.filter((s) => s.placeId !== op.placeId) }));
      const next = { days };
      return { ok: true, state: { plan: next, votes: pruneVotes(next, votes) }, summary: `🗑️ ${ctx.nameOf(op.placeId)} çıkarıldı` };
    }
    case "move": {
      const at = locate(plan, op.placeId);
      if (!at) return noop();
      const j = at.i + op.dir;
      if (j < 0 || j >= plan.days[at.d].stops.length) return noop();
      const days = plan.days.map((d, di) => {
        if (di !== at.d) return d;
        const stops = [...d.stops];
        [stops[at.i], stops[j]] = [stops[j], stops[at.i]];
        return { ...d, stops };
      });
      return { ok: true, state: { plan: { days }, votes }, summary: `↕️ ${ctx.nameOf(op.placeId)} taşındı` };
    }
    case "dow": {
      if (op.day < 0 || op.day >= plan.days.length) return { ok: false, error: "Böyle bir gün yok" };
      if (plan.days[op.day].dow === op.dow) return noop();
      const days = plan.days.map((d, i) => {
        if (i !== op.day) return d;
        const { dow: _drop, ...rest } = d;
        void _drop;
        return op.dow === undefined ? rest : { ...rest, dow: op.dow };
      });
      return {
        ok: true,
        state: { plan: { days }, votes },
        summary: `📅 ${op.day + 1}. gün: ${op.dow === undefined ? "gün seçimi kaldırıldı" : DAY_NAMES[op.dow]}`,
      };
    }
    case "addDay": {
      if (plan.days.length >= MAX_DAYS) return { ok: false, error: "En fazla 14 gün planlanabilir" };
      return { ok: true, state: { plan: { days: [...plan.days, { stops: [] }] }, votes }, summary: `➕ ${plan.days.length + 1}. gün eklendi` };
    }
    case "replace": {
      const next = sanitizePlan(op.plan, ctx.validIds);
      if (!next) return { ok: false, error: "Geçersiz plan" };
      return { ok: true, state: { plan: next, votes: pruneVotes(next, votes) }, summary: "⚡ Planı baştan oluşturdu" };
    }
    case "vote": {
      if (!locate(plan, op.placeId)) return { ok: false, error: "Mekân planda değil" };
      const cur = { ...(votes[op.placeId] ?? {}) };
      const had = ctx.cid in cur;
      if (had) delete cur[ctx.cid];
      else cur[ctx.cid] = ctx.name;
      const nv = { ...votes, [op.placeId]: cur };
      if (!Object.keys(cur).length) delete nv[op.placeId];
      return { ok: true, state: { plan, votes: nv }, summary: `👍 ${ctx.nameOf(op.placeId)} ${had ? "oyunu geri aldı" : "için oy verdi"}` };
    }
  }
}
