"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { applyOp, emptyState, type Op, type RoomState } from "./collab";
import { apiUrl, storage } from "./platform";
import type { ScoredPlace } from "./types";

export interface Me {
  cid: string;
  name: string;
}
export interface Participant {
  cid: string;
  name: string;
}
export interface LogEntry {
  t: number;
  by: string;
  text: string;
}
export type RoomStatus = "idle" | "loading" | "live" | "offline" | "notfound";

const ME_KEY = "selam:me";
const POLL_MS = 2000;

function newMe(): Me {
  return { cid: crypto.randomUUID().replace(/-/g, "").slice(0, 20), name: "" };
}
async function loadMe(): Promise<Me> {
  try {
    const raw = await storage.get(ME_KEY);
    if (raw) {
      const m = JSON.parse(raw) as Me;
      if (typeof m.cid === "string" && m.cid.length >= 8) return { cid: m.cid, name: typeof m.name === "string" ? m.name : "" };
    }
  } catch {}
  return newMe();
}
const saveMe = (m: Me) => void storage.set(ME_KEY, JSON.stringify(m));

/**
 * Ortak plan odasına bağlanır. Değişiklikler iyimser uygulanır (anında görünür), sunucu yanıtı kesindir.
 * Senkron: 2 sn'de bir sürüm-kontrollü yoklama (sekme görünürken); sunucu sürümü aynıysa gövde taşımaz.
 */
export function useRoom(roomId: string | null, places: ScoredPlace[]) {
  const [me, setMe] = useState<Me>({ cid: "", name: "" });
  const [state, setState] = useState<RoomState>(emptyState);
  const [version, setVersion] = useState(-1);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [status, setStatus] = useState<RoomStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const inflight = useRef(0);
  const versionRef = useRef(-1);
  const meRef = useRef(me);
  meRef.current = me;

  const ctx = useMemo(() => {
    const names = new Map(places.map((p) => [p.id, p.name]));
    return { validIds: new Set(names.keys()), nameOf: (id: string) => names.get(id) ?? id };
  }, [places]);

  useEffect(() => {
    let alive = true;
    loadMe().then((m) => {
      if (!alive) return;
      saveMe(m); // yeni kimlik üretildiyse kalıcı yap
      setMe(m);
    });
    return () => {
      alive = false;
    };
  }, []);

  const apply = useCallback((room: { version: number; participants: Participant[]; state?: RoomState; log?: LogEntry[] }) => {
    versionRef.current = room.version;
    setVersion(room.version);
    setParticipants(room.participants);
    if (room.state) setState(room.state);
    if (room.log) setLog(room.log);
    setStatus("live");
  }, []);

  const poll = useCallback(async () => {
    const m = meRef.current;
    if (!roomId || !m.cid || inflight.current > 0) return;
    try {
      const q = new URLSearchParams({ cid: m.cid, name: m.name, since: String(versionRef.current) });
      const res = await fetch(apiUrl(`/api/rooms/${roomId}?${q}`), { cache: "no-store" });
      if (res.status === 404) return setStatus("notfound");
      if (!res.ok) return setStatus("offline");
      if (inflight.current === 0) apply(await res.json());
    } catch {
      setStatus("offline");
    }
  }, [roomId, apply]);

  useEffect(() => {
    if (!roomId || !me.cid) return;
    setStatus((s) => (s === "idle" ? "loading" : s));
    poll();
    const id = setInterval(() => document.visibilityState === "visible" && poll(), POLL_MS);
    const onVis = () => document.visibilityState === "visible" && poll();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [roomId, me.cid, poll]);

  const dispatch = useCallback(
    async (op: Op) => {
      const m = meRef.current;
      if (!roomId || !m.cid) return;
      // iyimser uygulama: kullanıcı beklemeden görsün
      setState((prev) => {
        const r = applyOp(prev, op, { ...ctx, cid: m.cid, name: m.name || "Misafir" });
        return r.ok ? r.state : prev;
      });
      inflight.current++;
      try {
        const res = await fetch(apiUrl(`/api/rooms/${roomId}/ops`), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cid: m.cid, name: m.name, op }),
        });
        const body = await res.json().catch(() => ({}));
        if (res.ok) {
          setError(null);
          apply(body);
        } else {
          setError(body.error ?? "İşlem uygulanamadı");
          versionRef.current = -1; // sunucudaki gerçek durumu geri al
        }
      } catch {
        setError("Bağlantı yok — değişiklik kaydedilemedi");
        setStatus("offline");
        versionRef.current = -1;
      } finally {
        inflight.current--;
        if (versionRef.current === -1) poll();
      }
    },
    [roomId, ctx, apply, poll],
  );

  const setName = useCallback((name: string) => {
    const next = { ...meRef.current, name: name.trim().slice(0, 24) };
    saveMe(next);
    setMe(next);
  }, []);

  return { me, setName, state, version, participants, log, status, error, dispatch, clearError: () => setError(null) };
}
