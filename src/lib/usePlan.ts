"use client";
import { useCallback, useEffect, useState } from "react";
import { applyOp, type Op, type OpCtx } from "./collab";
import type { Plan } from "./types";

const key = (city: string) => `selam:plan:${city}`;
const empty = (): Plan => ({ days: [{ stops: [] }] });

function read(city: string): Plan {
  try {
    const raw = localStorage.getItem(key(city));
    if (raw) {
      const p = JSON.parse(raw) as Plan;
      if (Array.isArray(p.days) && p.days.length) return p;
    }
  } catch {}
  return empty();
}

/** Şehir başına plan; localStorage'da tutulur, sekmeler arası senkron. */
export function usePlan(city: string) {
  const [plan, setPlanState] = useState<Plan>(empty);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setPlanState(read(city));
    setReady(true);
    const onStorage = (e: StorageEvent) => e.key === key(city) && setPlanState(read(city));
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [city]);

  const setPlan = useCallback(
    (fn: (p: Plan) => Plan) => {
      setPlanState((prev) => {
        const next = fn(prev);
        try {
          localStorage.setItem(key(city), JSON.stringify(next));
        } catch {}
        return next;
      });
    },
    [city],
  );

  const has = (id: string) => plan.days.some((d) => d.stops.some((s) => s.placeId === id));
  const add = (id: string, day = 0) =>
    setPlan((p) =>
      p.days.some((d) => d.stops.some((s) => s.placeId === id))
        ? p
        : { days: p.days.map((d, i) => (i === day ? { ...d, stops: [...d.stops, { placeId: id }] } : d)) },
    );
  const remove = (id: string) =>
    setPlan((p) => ({ days: p.days.map((d) => ({ ...d, stops: d.stops.filter((s) => s.placeId !== id) })) }));
  /** Ortak oda ile aynı işlem kümesi; yerelde sunucu yok, doğrudan uygulanır. */
  const dispatch = (op: Op, ctx: Pick<OpCtx, "validIds" | "nameOf">) =>
    setPlan((p) => {
      const r = applyOp({ plan: p, votes: {} }, op, { ...ctx, cid: "local", name: "ben" });
      return r.ok ? r.state.plan : p;
    });
  const count = plan.days.reduce((n, d) => n + d.stops.length, 0);

  return { plan, setPlan, ready, has, add, remove, dispatch, count };
}
